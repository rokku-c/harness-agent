# Platform convergence tasks (2026-09-08)

| task | owner | scope | status |
|---|---|---|---|
| A Board standalone capability | main thread + Heisenberg | remove governor/coordinator/Claude integration/resource scheduling; keep the task board | done |
| B Multiple upstreams | Lagrange | named providers, several instances per protocol, explicit selection/round-robin, addable/removable form | done |
| C No compatibility | Aquinas | drop config auto-migration/old-schema adaptation and structured-text degradation | done |
| D Network substrate | main thread + Lagrange | standalone listener manager, four egress policies, authenticated main-node relay | done |
| E Port-free built-in apps | Heisenberg | UI Host/Deck pure handlers, DB shutdown and prefix routing | done |
| F SDK/host | main thread | automatic routing/tool registration, platform network config, composition and browser acceptance | done |
| G agentd core | main thread | machine/agent/mcpset/binding/revision control plane and port-free apps | done |
| H Gateway mcpset | main thread | set registry, binding resolution, allow/deny and audit rejection | done |

## Settled design

- All default platform-registered ports reference the same host route table; only an explicit apps filter produces a different service view.
- An app's SDK egress interface and provider route selection are separate; default is main-first, with no automatic replay.
- Network config is part of the SQLite authority, appId=platform-network; starting an app does not equal creating a listener.
- Board no longer carries any machine agent configuration; agentd/mcpset definitions are in platform-network.md, to be implemented separately later.
- Do not migrate or delete the user's real database, do not touch global Claude configuration; old structures error explicitly.

## Acceptance for this round

- 307 targeted tests pass (112 files); the full-repo test suite was not run.
- TypeScript check passes for the affected scope; the 100-line check passes for 263 related TS files.
- Import boundary: 0 errors; 12 warnings about other dependency declarations were left unexpanded.
- Browser: adding/saving/round-robin/explicit selection across three upstreams of the same apiType passes.
- Browser: after a Board task is created it is immediately readable from a second managed port; the page has no old governance controls.
- Main-node relay: the real peer→main→upstream chain, identity and target credential isolation, and streaming responses were all verified.
- Board compiled bundle: host-provided ABI, resource paths, and instance tool registration/unregistration verified.
- All verification used isolated SQLite/local mock upstreams; no user data was deleted/migrated, no global agent config was changed, no existing instance was restarted.

## Left to the next stage

- agentd's actual config adapter, the announce/heartbeat/withdraw HTTP protocol and agent config distribution are still to be implemented.
- The MCP Gateway's real stdio/streamable-http upstream transport is still to be wired in; the in-memory binding/policy pipeline is done today.
- The current network is an explicitly configured HTTP egress relay, not node auto-discovery or a VPN.

## Next-stage increment (continuing this round)

- I Registry lease: the pure control interface announce/heartbeat/withdraw is done; authenticated HTTP routes come next.
- J Agent config adapter: the in-memory plan/apply result is done; next is wiring the concrete Claude/Codex adapters, still only producing Gateway configuration.
- K Gateway data plane: streamable-http MCP upstream through EgressRouter, unified `/mcp-gateway/call` is usable; stdio and the full registry resolver follow.

This round added few new core verifications: agentd/mcpset/registry/upstream/host wiring cover the key behaviour, and the page test matrix was not expanded.

## Added this round (2026-09-08)

- Registry lease HTTP handler: announce/heartbeat/withdraw/servers query done.
- Agentd GatewayConfigAdapter: pure config plan/apply that only produces the Gateway entry point is done.
- Gateway streamable-http upstream: MCP Client lazy connect and EgressRouter fetch injection done.
- Next: switch the Gateway's server topology from static config to a Registry-backed resolver, and add the stdio transport.

## This round continues: Registry-backed Gateway

- The mcp-registry app went from a placeholder plugin to a real registry runtime.
- The Registry control plane is mounted: announce / heartbeat / withdraw / servers.
- The Gateway gained a Registry transport resolver and a dynamic HTTP upstream; a change in Registry state affects the next call.
- stdio transport is still unsupported; registry persistence and node auto-discovery are not done for now.

## Current-stage acceptance

- Shared Registry + Gateway + live Streamable HTTP MCP Server: end-to-end passes.
- After announce / heartbeat / withdraw the Gateway's next call behaves correctly.
- An endpoint change rebuilds the Gateway's MCP Client; stale Registry state is not cached.
- The standard MCP initialize/tools/list/tools/call entry points are wired in; the old JSON call entry point is no longer maintained.
- 97 targeted tests pass at this stage; the affected TypeScript, line-count and boundary checks pass.
