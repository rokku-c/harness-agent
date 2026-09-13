# Apps, entry, routing, egress (current design, 2026-09-08)

## Boundaries

- A built-in App = pure handler + schema + interface declaration; it should not create a temporary port for embedded runs.
- When the SDK registers/loads an App it registers routes and instance tools; disable/unregister revokes them.
- Platform listeners reference the same service route table. By default every registered port can reach the same services.
- A port may explicitly configure an apps allowlist; not configuring one means all services are shared. Undeclared isolation produces no isolation.
- For self-managed standalone processes/ports the platform carries no lifecycle, traffic, or consistency guarantee.

```text
port A ─┐
port B ─┼─ listener manager ─ shared route table ─ app handler
port C ─┘                          │
                             SDK context.fetch
                                  │
                          application egress policy
                            ┌─────┴─────┐
                            local    main node
                            └─────┬─────┘
                                external target
```

## Upstream is not egress

Every AI Gateway provider entry is `{id,apiType,baseURL,apiKey?,enabled?}`.
One apiType can have any number of upstreams; only the id must be unique.
When unspecified, round-robin over the enabled entries of the same protocol; `x-upstream-id` explicitly selects one, and a protocol mismatch fails.
`apiType` decides path and auth protocol; it does not stand for a vendor, and it does not decide which machine the request is sent from.
Failed model requests are not replayed automatically, and the internal headers that select an upstream are not passed through.

## The four egress policies

| App declaration | Selection |
|---|---|
| main-first (default) | prefer the main node; when the main node is unconfigured/unselectable, pick local |
| local-first | prefer local; when local is disabled, pick the main node |
| local-only | local only; fail when there is no local egress |
| main-only | main node only; fail when the peer has no main node configured |

"Prefer" means **choosing an available egress before sending**, not switching egress and retrying after a request fails.
The main node's own main is its local egress. No network, timeouts, and bad responses are all returned to the caller; there is no implicit replay.

## Network configuration

Network configuration is likewise managed through SQLite and the Config App, appId=`platform-network`.
First initialization can import it from `network` in the root effect.yaml:

```yaml
network:
  role: main
  listeners:
    - {id: local, hostname: 127.0.0.1, port: 8080}
    - {id: alternate, hostname: 127.0.0.1, port: 8081}
```

A peer can configure `main:{url,token}`. The main node must explicitly configure `relayToken` before it accepts authenticated relaying.
By default the main node is not a public proxy; a missing token, an unknown app, and an app that forbids main-node egress can all not relay.
relay endpoint=`/-/network/egress`; in transit node credentials and target credentials are kept apart, and streaming responses are returned as they are.
The current implementation is an HTTP relay; it does not claim to implement node auto-discovery, end-to-end VPN, identity issuance, or Tailscale features.

## agentd / mcpset: the current minimal implementation and the next stage

This round added the minimally runnable `@effect-agent/agentd`, the `agentd` platform App, and `mcp-gateway`'s mcpset registry.

Currently supported: machine/Agent registration, MCP server references, mcpset, Agent binding, revision receipts, allow/deny tool filtering.
Not yet done: real remote MCP transport, the announce/heartbeat HTTP protocol, the Agent config adapter writing Claude/Codex files.

Board manages only task and board data; access governance moved to an independent capability:

```text
machine agentd → config adaptation center → generates some Agent's MCP config
                                  │
                            MCP Gateway
                         ┌────────┴────────┐
                      mcpset A          mcpset B
                    server1/server2    server2/server3
```

- Machine: machine identity, online status, the range of configuration allowed to be pushed.
- Adapter: generating and applying the current config formats such as Claude/Codex, so that apps do not each edit global files.
- McpSet: a stable setId, member server references, tool filtering/policy; several sets may exist at the same time.
- Binding: machine/agent instance → the set of sets it may use; the configuration points only at the MCP Gateway entry.
- Configuration push is an explicit, verifiable operation; machine identity and approval do not depend on Board tasks or prompts.
- The Gateway already resolves binding→mcpset→server/tool policy in an in-memory pipeline; the next step is wiring in real MCP transport.
- Going forward the MCP Gateway discovers and calls per set independently, with authorization at the gateway boundary — it cannot rely on the setId in the URL alone.

No aliases, compatibility layers, or automatic migrations are kept for old configuration/old schemas. Old databases are not deleted automatically; when they do not match the current structure, they fail with an explicit error.

## Landed in this stage (2026-09-08)

- `@effect-agent/agentd`: Machine/Agent registration, MCP Server references, McpSet, Agent binding, revision/applied receipts.
- The `agentd` App: a portless control plane; the host provides the registration tools uniformly.
- `@effect-agent/mcp-registry`: announce/heartbeat/withdraw with a token; the token does not enter the server record.
- `@effect-agent/agentd` GatewayConfigAdapter: generates only Agent configuration that points at the Gateway; it exposes no real MCP server endpoint and writes no user files.
- `@effect-agent/mcp-gateway`: the McpSet binding policy and the streamable-http upstream adapter are wired in; the HTTP upstream uses the host-injected EgressRouter fetch.
- `POST /mcp-gateway/call`: takes identity from `x-agent-id/x-session-id/x-request-id`; the call body carries only setId/serverId/tool/args.

Still not landed: the real registry HTTP announce/heartbeat routes, stdio upstream, the actual apply of the Agent config file adapter, node-level identity authentication and target-address policy.

## Registry runtime lease (2026-09-08)

The Registry now provides a pure-handler control plane:

- `POST /-/registry/announce` + `Authorization: Bearer ...`
- `POST /-/registry/heartbeat`
- `DELETE /-/registry/:serverId`
- `GET /-/registry/servers`

Credentials are used for control-plane authentication only and do not enter the server record/list. The HTTP handler itself does not listen on a port; the platform host decides where to mount the entry. The Gateway upstream already supports lazily connecting streamable-http MCP, but the Registry transport resolver and stdio transport are still left for the next stage; the current static configuration can still supply the endpoint directly.

## The current Registry-backed resolver

The Gateway already provides `makeRegistryTransportResolver` and `makeRegistryHttpUpstream`: every call re-reads the Registry by serverId, so after offline/withdraw the next call is immediately unusable; a changed endpoint destroys the old MCP Client and lazily rebuilds. The Gateway does not cache the Registry's health state.

The `mcp-registry` App is now a portless runtime plugin, providing the `/mcp-registry` query and the `/-/registry/*` lease control routes. Ports are still managed by the platform listener manager.

## Shared Registry end-to-end status (2026-09-08)

The current platform composition root creates one shared Registry and injects it into `mcp-registry` and `mcp-gateway` through AppRuntimeContext. Gateway configuration stores only `sets`/`bindings`/policy, never server endpoint; server topology is managed by the Registry App, and the Gateway resolves it live on every call.

The entry for a standard Agent MCP configuration is `/mcp-gateway`: `tools/list` exposes `mcp_gateway_call`, `tools/call` reads the transport-level identity, then executes by binding→set→server. The old custom `/mcp-gateway/call` and the effect-server `/mcp` dual track have been deleted.
