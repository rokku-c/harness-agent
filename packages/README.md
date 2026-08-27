# Package boundaries

```text
@effect-agent/core
  Pure declarations and runtime. Browser-safe; depends only on Effect.

@effect-agent/builtin
  Maintained contracts, adapters and transports:
    contracts/   stable protocols such as effect-agent.core/v1
    adapters/    direct Core, remote Core, MCP, storage, model adapters
    transports/  stdio, Streamable HTTP, WebSocket and browser channels

@effect-agent/community
  Optional third-party adapters and integrations. Core never depends on it.

@effect-agent/repr
  Shared semantic UI state and intents. Exposed as effect-agent.repr/v1.

@effect-agent/ui
  Shared adaptive layout profiles and Yoga-based region planning. Ratios are
  quantized to 9:16, 3:4, 1:1, 4:3, 16:10, 16:9 and 21:9 anchors; variants may
  replace the complete region tree, not merely resize components.

@effect-agent/tui
  Terminal projection of Repr. No knowledge of Core or transports.

@effect-agent/webui
  Compact DOM projection of Repr. No knowledge of Core or transports.
```

## Connection directions

External UI to Core and Core to Core share `effect-agent.core/v1`:

```text
UI ──stdio/http/websocket── CoreEndpoint
Core ──direct memory─────── CoreEndpoint
Core ──stdio/http/websocket── remote CoreEndpoint
```

`CoreEndpoint` exposes sanitized connection descriptions, invocation and lifecycle
control. A transport carries requests/events; `remoteCoreAdapter` turns the transport
back into a normal Connection. Therefore remote topology does not add a core concept.

Every endpoint requires an explicit `CorePolicy`. Builtins include trusted,
observe-only, and per-connection capability policies; remote access is never implicitly
granted full control.

Node-only transports must use a dedicated export and must never be imported by
`@effect-agent/core` or browser entry points.

## MCP adapters

MCP is an adapter protocol, not a core primitive. `@effect-agent/builtin` uses
the official TypeScript SDK for initialization, version/capability negotiation,
request/result validation and transport lifecycle. The browser entry includes
Streamable HTTP; stdio is isolated in `@effect-agent/builtin/mcp/node`.

```ts
import { ConnectionRuntime } from "@effect-agent/core"
import { Effect } from "effect"
import {
  mcpConnectionSpec,
  mcpStreamableHttpAdapter
} from "@effect-agent/builtin"
import { mcpStdioAdapter } from "@effect-agent/builtin/mcp/node"

const http = mcpStreamableHttpAdapter()
const stdio = mcpStdioAdapter()
const spec = mcpConnectionSpec({
  id: "workspace-tools",
  adapters: [
    { kind: http.kind, priority: 0, config: { url: "https://example.test/mcp" } },
    { kind: stdio.kind, priority: 1, config: { command: "my-mcp-server" } }
  ]
})

const runtime = await Effect.runPromise(ConnectionRuntime.make({
  specs: [spec],
  adapters: [http, stdio]
}))
```

Application-defined transports use `mcpSdkAdapter({ createTransport })`. Its
`configureClient` hook is the dependency-injection point for client-side roots,
sampling, elicitation and custom protocol handlers.

## Claude Code as a Connection

Claude Code is a Node behavior adapter and is deliberately excluded from the
browser entry. A browser/TUI can reach it through a remote Core connection.

```ts
import { ConnectionRuntime } from "@effect-agent/core"
import { Effect } from "effect"
import {
  ClaudeCodeCapabilities,
  ClaudeCodeCapabilityGroups,
  claudeCodeAdapter,
  claudeCodeConnectionSpec
} from "@effect-agent/builtin/claude-code/node"

const claude = claudeCodeAdapter({ options: { cwd: process.cwd() } })
const spec = claudeCodeConnectionSpec({
  id: "claude",
  adapters: [{ kind: claude.kind }],
  capabilities: [
    ...ClaudeCodeCapabilityGroups.run,
    ...ClaudeCodeCapabilityGroups.inspect,
    ClaudeCodeCapabilities.interrupt,
    ClaudeCodeCapabilities.setModel
  ]
})

const runtime = await Effect.runPromise(ConnectionRuntime.make({
  specs: [spec],
  adapters: [claude]
}))
const answer = await Effect.runPromise(runtime.invoke(
  "claude",
  ClaudeCodeCapabilities.run,
  { prompt: "Inspect this repository" }
))
```

The adapter publishes each `SDKMessage` on `ConnectionSession.events` with its
caller-selected/generated `runId`. A concurrent invocation can interrupt the
run or change its model/permission mode. Capabilities are grouped into `run`,
`control`, `inspect`, and `sessions`; only `run` is declared by default, so
filesystem and session mutations require explicit opt-in.

## Provider and Notation connections

`providerAdapter` exposes an injected provider catalog as `provider/list`,
`provider/get`, and `provider/generate`. The resolver is deliberately injected,
so an application may use AI SDK, a gateway, a local model, or a test model
without changing the connection declaration.

`notationAdapter` is an inversion-of-control metadata service. It stores
versioned entries for any target (for example `connection:github:tools/call` or
`tool:search`), including description, extra instructions, and help. Use
`annotateConnectionSpec` when building a snapshot to merge descriptions into a
connection contract; `notationInstructions` and `notationHelp` supply context
to an agent. `diff` compares versions, and an application can invoke the
provider connection at startup to generate missing descriptions, then upsert
the result as a new notation version. The storage interface is intentionally
small so SQLite/file persistence can replace the in-memory store.
