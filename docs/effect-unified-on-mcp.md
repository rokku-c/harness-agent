# Design mapping for unifying on MCP (2026-07-28 revision)

Goal: apart from **permissions** (a facade layer on top of MCP), all cross-app registration and
communication goes only through the latest **Model Context Protocol** (the 2026-07-28 era, modern
era) — the self-made announce/call/… is no longer maintained; `packages/effect-mesh` (self-made
JSON-RPC) has been **deleted** along with it.

## Mapping table (planes → MCP)

| effect layer | MCP (2026-07-28) |
|---|---|
| app registration/callback | each app = one **MCP server**; the main node = MCP **client**, which after connecting runs
  `server/discover` (modern liveness + capabilities + extensions + versions) → registration |
| interface plane | **tools** (`tools/list` returns tools carrying an inputSchema; `tools/call` executes) |
| UI plane | **resources**: `ui://…` resources are served by `resources/list`/`resources/read`;
  in-session rendering goes through MCP Apps (`_meta.ui.resourceUri`, host fetches → sandboxed iframe → `ui/*`) |
| storage plane | **resources** read/write (`resources/read`; writes via an exposed write tool or
  resources/templates + modern subscriptions/listen pushing changes) |
| config plane | one read-only resource (`config://ns/app`) + one write tool (`config_set`) |
| namespace | lives in **server/tool naming** and connection isolation: `ns__app__tool` (aligned with dsh
  `mcp__<server>__<tool>`); one independent server/client pair per ns, isolated by construction |
| bidirectional (home→app UI push) | modern **subscriptions/listen** + notifications/subscriptions/acknowledged;
  or MCP Apps' host→app push (2026-07-28 semantics) |
| remote/embedded | streamable-http (modern, sessionless) or stdio; in-process uses
  **InMemoryTransport** (same protocol, zero network) |
| permissions | a facade layer above MCP: home consults the
  effect-planes authorisation table (plane granularity) before forwarding `tools/call` / `resources/read`;
  a denial means no MCP request is sent → audit record |

## Key points

- **In-memory is also real MCP**: an in-process app uses a pair of `InMemoryTransport`, so between home client and
  app server it is standard MCP initialize/discover/tools. That way "in-process vs remote" has zero difference.
- **No more self-made wire**: the self-made mesh has been deleted (2026-09-13); cross-app communication always goes through MCP methods.
- **SDK version**: the repo currently has `@modelcontextprotocol/sdk ^1.30`; the 2026-07-28 modern
  methods (server/discover, subscriptions/listen, Mcp-* headers, etc.) require upgrading the SDK to a version that supports
  the "modern era"; before upgrading, use its compatible subset (initialize/tools/list/call/resources/read).
- Naming isolation: tool names carry the `ns__app` prefix; cross-ns permissions are decided by the facade, and name uniqueness is guaranteed by the ns.

## Phase rollout

- **B-MCP [done]**: an in-process app = **MCP server** (packages/effect-mcp buildNodeMcpServer),
  home = **MCP client** InMemory registration/forwarding (`connectNodeToHome`), naming `ns::appId`.
- **C [done]**: ui/store exposed as **MCP resources** (`ui://`, `store://{key}` template),
  read by home `resources/list|read` (connectNodeToHome.resources/readResource).
- **D [done, SDK 1.30 web-standard]**: packages/effect-mcp-http `serveMcpHttp` uses
  `WebStandardStreamableHTTPServerTransport` to expose a node MCP server as Bun HTTP
  (per-request fresh transport avoids GHSA-345p-7cg4-v4c7; GET→405 falls back to POST JSON);
  a remote MCP client connects directly. The 2026-07-28 modern server/discover etc. need a later SDK upgrade.
- New console apps: apps/mcp-registry-app, apps/mcp-gateway-app (unified configSchema + UI).

- **Data rendering/agent reading [done]**: effect-ui declaration nodes support `bind` (JSON pointer) → projected into
  json-render `{$bindState:…}` (text/button/formField); data is injected at render time (state).
  `packages/effect-apps` provides the MCP entry points: `apps_list / app_read(ui|state|config|store) /
  app_call`, browsing and operating any namespace's apps after per-op authorisation — what the agent reads is the data plane
  (spec+state+config+store), not the rendered DOM.
