# MCP Gateway Surface and Agent Access Design

> Status: design v0.1 (2026-09-10). Source constraints: `docs/platform-network.md`,
> `docs/effect-unified-on-mcp.md`, and `docs/board-v2-mcp.md`.
>
> Governing principle: every agent tool is exposed and governed by `mcp-gateway`.
> Board integration form is still open; gateway tool-surface configuration is in scope.

## 1. Principle

1. Agents have one MCP entry point: `/mcp-gateway`. Real upstream endpoints or stdio
   commands never appear in agent configuration.
2. The gateway decides which tools exist for each caller. Binding, set, server, rules,
   projection, and audit all run there.
3. Membership, sets, policy, and audit are gateway or registry data, not private app
   conventions and not prompt text.

Direct stdio or HTTP servers in `~/.claude.json` are bypasses even when they work.

## 2. Current Findings

| Fact | Evidence |
|---|---|
| Gateway is alive but empty | `GET /mcp-gateway` returns empty servers, sets, and bindings |
| Gateway config is empty | `.effect-agent/overrides.json` has `"mcp-gateway": {}` |
| MCP surface exposes one proxy tool | `mcp-server.ts` lists `mcp_gateway_call` |
| Gateway pipeline exists | resolve -> rules -> upstream -> audit |
| Board is currently direct stdio in Claude Code | `~/.claude.json` starts board MCP directly |
| Registry announce accepts streamable HTTP only | `mcp-registry` validates `streamable-http` |
| Gateway upstream already supports stdio | `registry-upstream.ts` and `upstream-stdio.ts` |
| Shared registry starts empty | `apps/effect-server/src/boot/runtime.ts` creates an empty registry |

Gap: direct access is used, gateway has no topology, agent configuration is not generated,
and prompt gating currently depends on the direct board server.

## 3. Target Shape

```text
agent (claude-code / codex / probe)
   |  one MCP config: POST /mcp-gateway
   |  headers: x-agent-id / x-session-id / x-request-id
   v
MCP Gateway -> identity -> binding -> set -> server -> rules -> audit
   |                                  upstream: stdio or streamable HTTP
   v
shared mcp-registry or static resolver
```

Credentials and topology live in the gateway. Agents receive one URL and identity headers.

## 4. Configurable Tool Surface

### 4.1 Modes

| Mode | `tools/list` | `tools/call` | Tradeoff |
|---|---|---|---|
| `proxy` | `[mcp_gateway_call]` | Call the proxy with `{ setId?, serverId?, tool, args }` | Clean audit, no upstream discovery; agents cannot auto-discover upstream schemas |
| `native` | Flattened reachable tools with upstream input schemas | Call the tool name directly; gateway resolves `serverId` and reuses the same pipeline | Familiar to current prompts; list cost and name collision handling matter |

### 4.2 Configuration

Extend the mcp-gateway app config:

```jsonc
{
  "surface": "proxy",
  "sets": [
    {
      "setId": "board",
      "name": "Board",
      "servers": ["board"],
      "surface": "native",
      "toolPrefix": "",
      "allowTools": [],
      "denyTools": []
    }
  ],
  "bindings": [{ "agentId": "claude-code", "setIds": ["board"] }],
  "defaultAction": "deny",
  "captureArgs": false
}
```

The default prefix for native names is `<serverId>__`. An empty prefix preserves bare names
such as `board_*` during migration.

### 4.3 List and Call Rules

- Add `list(serverId)` to `McpUpstream`. HTTP and stdio upstreams implement it with the SDK
  `Client.listTools`.
- Cache tool lists by the registry record signature: transport, endpoint, command, args,
  and env. A signature change invalidates the cache.
- `native` `tools/list` first resolves the caller binding, then lists each reachable
  server, then applies `allowTools` and `denyTools`.
- Lists are advisory. `tools/call` must resolve, filter, and enforce again.
- Under `defaultAction: "deny"`, only tools from allowed servers and sets appear.
- Verify that `tools/list` receives request headers like `tools/call`. If it cannot, use a
  per-agent server instance and pin that behavior with tests.

## 5. Board Upstream Options

| Option | A. Registry stdio | B. Board streamable HTTP |
|---|---|---|
| Approach | Registry accepts `stdio + command/args/env`; gateway lazily starts the process | Board adds an HTTP MCP host using `effect-mcp-http` and announces it |
| Change area | registry validation and storage plus the registry app | board host, endpoint, and token policy |
| Process model | Gateway child process shares the board SQLite file | Separate listener and endpoint |
| Cross-machine | Local only | Supports remote probe or agent access |
| Risk | Registry must store stdio records | Endpoint must remain gateway/trusted-only, never fall back into agent config |

Neither option changes the rule that agents only see `/mcp-gateway`.

## 6. Identity, Audit, and Config

- Identity: `x-agent-id` is required. `x-session-id` and `x-request-id` are optional.
  Binding `agentId` must match the header. Agentd should eventually generate this config.
- Audit: gateway records `.effect-agent/mcp-gateway.jsonl`. `captureArgs` uses redaction
  before storage.
- Config: surface, sets, and bindings live in the mcp-gateway Config plane and are edited
  through console or Config App. Server topology remains in the registry.

## 7. Migration

1. Keep the current board stdio entry until the gateway path works.
2. Connect board to the gateway with option A or B, configure sets, bindings, and native
   surface, and verify the same `board_*` behavior.
3. Replace `~/.claude.json` with one `/mcp-gateway` HTTP entry, or let agentd generate it.
4. Align prompt gating with the actual board tool names during that switch.

## 8. Delivery Order

| Phase | Work | Acceptance |
|---|---|---|
| P0 | Choose board option A/B and default surface | This design is reviewed |
| P1 | `McpUpstream.list`, native aggregation, config schema | Gateway tests cover list modes, collisions, deny filtering, and call re-authorization |
| P2 | Board through gateway plus sets, bindings, surface config | Gateway ingress test calls `board_*` through gateway, rejects missing identity, and rejects unbound sets |
| P3 | Agentd config apply, Claude config switch, prompt alignment | Dogfood and one live conversation confirm board tools through gateway |

## 9. Open Questions

- Board option A versus B.
- Default surface mode for existing agents.
- Registry persistence path after restarts.
- Whether native tool-list cache TTL should be configurable.
- Whether `tools/list` has request-header context.
