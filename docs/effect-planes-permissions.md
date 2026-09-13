# effect-agent — unified Planes (interface / UI / storage) and permissions

> **Status (2026-09-13)**: §1's resource model and addressing syntax have landed in `packages/effect-authz`
> (`resource.ts` / `match.ts` / `decide.ts`), and the plane control plane in effect is
> `/-/planes/*` in `packages/effect-host/src/{control,operations}.ts`.
> The `packages/effect-planes` in §5/§6 of this document **was not kept**: its `makePlanes` was a second
> implementation of the same plane model (already replaced by effect-host) and has been deleted; the only
> part of it still in use, `NodeStore`, was merged into `packages/effect-bundle/src/store.ts`. The text below
> is preserved as designed; read it against this note.

Goal: every app(node)'s **interface, UI, storage** is expressed with one unified, namespaced,
addressable resource model; **permission** is an explicit layer of that model — as long as a node has
permission, it can **read/call another node's** interface, UI, or storage (cross-node reads are denied by
default and allowed only after authorization).

## 1) Resource model: a node's four planes

Every node = `(namespace, appId)`. The resources it exposes are addressed uniformly by plane:

```
interface : ns::appId.tool                      # call an existing one (mesh)
ui        : ui://ns/appId/<view>                # read/load the declarative UI (UiDocument)
storage   : store://ns/appId/<key...>           # read/write this node's data (JSON documents)
config    : config://ns/appId                    # this node's config (schema-driven)
```

- **Unified**: the UI is a language-agnostic UiDocument; storage is a unified document-style KV (JSON,
  prefix-addressed); the interface is a schema-driven tool. All three layers "can export a schema/description".
- **Isolated by default**: cross-namespace is always denied; the same node can read/write itself; within the
  same ns it is visible by default (and can be tightened).
- Every node's UI and storage **can be read by an authorized party**, but both reads and writes go through
  the same permission checkpoint.

## 2) Permission model (Authorization)

- **Principal**: the caller = `(namespace, bundleId)` or `(agent/session identity)`,
  resolved from the uniform headers `x-namespace / x-bundle-id / x-agent-id / x-session-id` (already present).
- **Resource (scope)** = `(plane, ns::appId, [item])`.
- **Actions**: `read` (read UI/storage/description), `call` (call an interface), `write` (write storage/config).
- **Rules** come from two sources and go into one authorization table:
  1. Static declaration: manifest `requires/grant` (e.g. `grant: [{ toNs, planes:[ui,store] }]`);
  2. Runtime: consent (reusing the consent store).
  Rules default to `deny`; only an explicitly allowed (principal, plane, target) passes.
- **Enforcement point**: home's protocol boundary.
  - Interface calls: after mesh.call's isolation check and beside the audit hook, fold in `can(callerNs, "interface", target)`;
  - UI/storage/config reads: the uniform endpoint home exposes (e.g. `/-/planes/read`) authorizes first, then returns;
  - audit: every allow/deny goes into the audit event (mcp-gateway style).

## 3) Storage abstraction

- `NodeStore`: a unified document KV — `get(key)/set(key,value)/list(prefix)` (JSON).
- Every node **registers** its store into the unified planes (it may proxy reads and writes to the protocol:
  a remote node's store operations reach the real storage through `mesh/store-get|set` dispatch).
- Reading another node's storage = passing the authorization table + resolving to that node's store (a local
  object or a protocol call); home holds no node's implementation object implicitly — still "protocol only".

## 4) Reading the UI

- Every node registers its `UiDocument` (effect-ui view / json-render / html).
- "Reading another node's UI" = after authorization, obtaining its UiDocument (the declaration layer),
  rendered by the uniform client; the live interface is still served by that node (same-origin iframe /
  remote endpoint), but **reading the catalog and the description** goes through authorization too.

## 5) Reuse and landing spots

- Reuse: effect-interface (tool schema), effect-ui (UiDocument),
  effect-config (schema), consent/audit, effect-bundle (manifest grants declaration).
- New: **packages/effect-planes** — the unified authorization table (can/grant/revoke, per plane) +
  registration of a node's store/ui description + a uniform cross-node read entry; plus a minimal `NodeStore`.

## 6) Landing order

- **A — the Planes model + authorization**: `packages/effect-planes`: the rule table (plane granularity),
  NodeStore, registerNode (store+ui+interface description), the readStore/readUi/readInterfaceSchema
  uniform entry, cross-ns deny by default + grant (per plane). Tests cover authorization/denial.
- **B — wire into mesh**: fold the `interface` decision into mesh.call (the uniform enforcement point);
  remote store/ui reads and writes go through dispatch (`store/get|set`, `ui/get`).
- **C — HTTP/UI endpoints**: home exposes `/-/planes/*` (reading store/ui/config), with uniform
  authentication; console/config go through it.
- **D — migration**: board/ui-host/deck/each bundle declares store+ui+grants and registers into planes.
