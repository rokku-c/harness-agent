# effect-agent — Bundle + Register-back + Mesh architecture

> Decisions made (2026-09-08): ① the bundle artifact = **directory-shaped** (dist/<bundleId>.effect-bundle/);
> ② namespace defaults to **isolated + explicit authorization** (cross-ns needs requires/consent). P0 (compile + in-place register-back) is implemented in packages/effect-bundle.


Goal (against deepseek-harness's bundle, dsh: the profile lists bundles; a bundle's package.json
declares `dsh: { bundle: { patch } }`; the loader automatically imports its `./typert` to register capabilities):

> An effect-agent "plugin/app" (interface + config + UI) can be **compiled into a self-contained bundle**;
> that bundle can be **loaded in any host/runtime**, and after loading **registers back** with the registry;
> the registered nodes can **mesh** (discover and call each other), with **namespace** isolation / stacked instances;
> all of this must support **remote** (the bundle runs elsewhere), which needs a **remote protocol**.

This design reuses abstractions that are already in place rather than starting over:
`packages/effect-host` (EffectPlugin registration/hot swap), `packages/effect-interface`
(zod schema interface registration), `packages/effect-config`, `packages/effect-ui`+`UiDocument`
(declarative UI, language-agnostic), `packages/mcp-registry` (server catalog/heartbeat),
`apps/effect-server` (composition root + discovery + `registrar` inproc/stdio/http, console).

---

## 1) Bundle artifact (build)

A bundle = the **distributable unit of one (or more) app/plugin**, artifact:

```
dist/<bundleId>.effect-bundle/
  effect.bundle.json        # manifest (self-describing)
  entry.js                  # the compiled loader: calls the registration API
  ui/…                      # optional UiDocument / json-render / html assets
```

`effect.bundle.json` (self-describing, schema exportable):

```yaml
bundleId: io.effect-agent.board@0.13.0
appId: board
abi: effect-1            # the ABI version with the host runtime
namespace: ops            # default namespace (overridable at load time)
transport: mesh          # inproc | stdio | http | mesh (remote, bidirectional)
requires: []             # declares dependency on other bundle/interface ids (by id only, not by implementation)
provides:
  interfaces: [ { name, description, inputSchema, outputSchema } ]  # exported from zod
  configSchema: { … }     # exported from configSchema
  ui: [ { lang: effect-ui|json-render|html, document: … } ]
entry: entry.js
```

Compiling is just bundling the app's existing `effect.yaml` + `src/effect-plugin.ts`/`effect-config.ts`/
`effect-ui.ts(+html)` with bun build into the self-describing artifact above; the manifest's schema section comes entirely from the
existing zod/effect-interface exports, guaranteeing "the schema can be exported".

## 2) Load anywhere + register back

Single entry point: `loadEffectBundle(bundle, options)`:

```ts
options: {
  // in-place load
  host?, registry?, configs?, uiViews?,             // registration targets within this process
  // remote register-back
  remote?: { url, token, namespace },
}
```

- **In-place (inproc)**: call `host.register(plugin)` + `registry/configs/ui…` to register its
  capabilities and return a disposer (identical to today's effect.yaml load path, only sourced from a compiled bundle).
- **Remote/embedded (any runtime, browsers included)**: the bundle's `entry.js` runs there and, over the **remote
  protocol**, sends a `registry/announce` to "home" (the registry, e.g. effect-server), carrying the manifest +
  namespace; home validates it (may require consent) → registers it as a **remote node**, after which every call to it goes over the
  remote protocol (rather than an in-process function).

The point of "register back": the registering party is **the bundle itself**, not the host pulling it; the host only provides the ABI and the address.

## 3) Mesh + Namespace

- In the registry every addressable unit is called a **node**: `(namespace, bundleId, endpoint)`.
  One bundle can be loaded many times, each landing in a different namespace → several instances of the same app coexist.
- **namespace** is a first-class citizen: every key carries ns
  `ns::appId::tool` / `ns::appId::config` / `ui://ns/appId/…`;
  the bundle declares a default ns and the loader may override it (e.g. workspace-b). ns carries both scoping and the authorization wall
  (cross-ns access needs an explicit declaration/consent).
- **mesh** = nodes discovering and calling each other:
  - each node announces its own `provides` (interface schema + UI + config) to the registry;
  - the registry does `discover(capability, ns?)` and returns reachable nodes;
  - the caller routes to the target ns/node as needed (health/heartbeat reuse mcp-registry's TTL).
  - e.g.: a remote bundle (the board UI running in a browser, ns=workspace-b) registers back with home, then
    meshes to `ops::board`'s interface for live data, while home can also `ui/push` to the remote UI.

## 4) Remote protocol (effect remote)

One **symmetric JSON-RPC 2.0** protocol, reusing and extending the existing MCP style:
methods = `registry/announce|discover`, `invoke`, `config/get|set`,
`ui/push`, `events/sub`. Request headers carry identity: `x-namespace, x-bundle-id,
x-agent-id/x-session-id/x-request-id` (reusing what exists today).

Transport is pluggable and orthogonal to the protocol (the same MCP/registrar philosophy):
- `memory` (same process), `stdio` (child process), `streamable-http` (remote one-way, already exists)
- `ws` (new: **long-lived bidirectional**, supports host→app `ui/push`/event notifications, a resident mesh)

Registering is just "announcing into the protocol":

```jsonrpc
{ "id":1, "method":"registry/announce",
  "params": { "namespace":"workspace-b", "bundle": "<manifest>",
              "endpoint": { "transport":"ws", "url":"…" } } }
```

Consent/audit/redaction: announce and cross-ns invoke can reuse the existing consent store and
mcp-gateway's rules/audit/redaction; authorization is by (bundle, token, ns).

## 5) Landing steps (suggested order)

- **P0 — Bundle artifact + in-place register-back**: `packages/effect-bundle` (compile + load;
  use board as the first bundle). Unit test: compile→load→register→disposer. [done 2/2]
- **P1 — Namespace + Mesh**: `packages/effect-mesh` — ns isolated by default + explicit grant,
  announce/discover/call over memory + a JSON-RPC http protocol skeleton. [done 4/4, later **deleted**:
  the hand-rolled wire was replaced by MCP, see `effect-unified-on-mcp.md`; this file is kept as the plan record from that time]
- **P1 — Namespace + Mesh (local protocol)**: add ns to the registry/UI/config keys; a mesh layer
  announce/discover/invoke over memory (start with the in-memory transport to get it working end to end).
- **P2 — Remote protocol**: get stdin/stdio and streamable-http working (the existing registrar base),
  add `registry/announce` and bidirectional calls; wire in consent/audit. [done 6/6: announce + proxied-call round trip]
- **P3 — WS long connection + UI push**: let a remote bundle's UI receive home pushes too; in a browser host the
  board bundle registers back + meshes to `ops::board`. [P3-lite done: the HTTP event endpoint mesh/push receives host→remote-UI pushes; a resident WS is left to do]
- **P4 — Verify with board**: compile board into a bundle, load it inproc and remotely,
  and have the endpoints mesh with each other. [done: board compiled into the `io.effect-agent.board@0.13.0` bundle,
  register-back in-process to host(enable)+config+ui, disposers all cleared]

## 6) Open decisions (need your call)

- Single file (wasm-ish) or a directory-shaped bundle (P0 does directory-shaped first, cheap)?
- ns syntax and visibility: is cross-ns invisible by default, reachable only through an explicit `requires: ns::app`?
- Remote authorization: is a per-(bundle,ns) token enough, or do we need OAuth?
- Telemetry/audit: do all mesh calls go through mcp-gateway audit (default yes).
