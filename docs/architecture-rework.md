# Architecture rework: SDK · behavior kernel · operation set · hot update and rollback

> Status: design v0.1 (2026-09-10). This is a **platform-level** architecture rework that gathers the
> existing implementations onto one main line.
> For the existing layer documents see `layers.md` (package layering), `effect-unified-on-mcp.md` (MCP mapping),
> `effect-bundle-mesh.md` (bundle / register back / mesh), `effect-planes-permissions.md` (planes and permissions),
> `platform-network.md` (ports/routes/egress + agentd/mcpset). `architecture.md` is mantis-specific, not platform.
>
> **Decisions made (2026-09-10)**: ① kernel hot-update granularity = **K2** — the kernel itself is also a
> hot-swappable artifact, and the host keeps only a minimal base;
> ② **the app itself must also be hot-updatable** — a single-point replacement, a smaller blast radius than a kernel
> hot swap, an independent goal. See §6.
> ③ support for **container nodes** — one node carries the deployment of several apps, and the deployment unit
> changes from an app to "node × app set". See §8.

## 0. Goal (the user's own words)

> What we provide is the **SDK and the built-in apps**. When an app is developed with the SDK, it
> automatically carries our **behavior-pattern code** with it (which defines **the whole set of operations a user
> can perform**, host and non-host nodes included); after startup, beyond the app's own behavior,
> the behavior that uses the SDK is **driven by our code**; this **core code can be hot-updated**; and the
> host can **push upgrade hot updates** to **compatible** apps, and **roll back when one crashes**.

**Addendum (2026-09-10)**:
- apps are distributed → **the same app artifact must be able to run on all three tiers: OS / browser / JS sandbox**, the sandbox being the lightest (see §7).
- besides the kernel, **the app itself must also be hot-updatable** (see §6.4; it is an independent goal, not just a rehearsal for the kernel swap).
- support for **container nodes**: one node (machine/container/host) can **carry the deployment of several apps** (see §8).

## 1. Terminology

| Term | Meaning | One-line criterion |
|---|---|---|
| **Operation Set** | the complete list of "every operation that can be performed" on a node | not scattered functions, but one list that is enumerable, can export schema, and can be authorized |
| **Kernel** | the code we ship with the SDK that **drives the app's non-domain behavior** | app authors do not write it; the SDK attaches it automatically |
| **Node** | the carrier of an operation set = `(namespace, appId)` | split into **host nodes** (the platform itself) and **app nodes** (each app) |
| **Declaration layer / Domain layer / Kernel layer** | the three attributions of one app development | see §3 |

## 2. Requirement ↔ current state mapping

| # | Requirement | Current state | Evidence |
|---|---|---|---|
| a | we provide the SDK + the built-in apps | **exists**: `packages/effect-*` is the SDK, `apps/*` are the built-in apps | 49 packages; `bun run check:boundary` 0 error |
| b | developing with the SDK **carries the behavior-pattern code automatically** | **partly exists**: `registerEffectApp` automatically registers config schema, egress, UI/HTML, interface tools, console path, and rolls back on failure | `packages/effect-apps/src/registration/register.ts:9-37`; `metadata.ts:20-38` |
| b' | it defines **the whole set of operations that can be performed** | **missing**: the operation set today **has no single model**; it is scattered across descriptor fields + the MCP projection, and the host node's privileged surface is even more scattered control routes | §4 |
| c | after startup, SDK behavior is **driven by our code** | **exists**: plugin lifecycle, route dispatch, config hot-read, UI hosting, MCP/agent surface, permissions, observe are all wrapped around the app's `load()` by the kernel | `packages/effect-apps/src/registration/runtime.ts:6-19` (including the comment "Instance interfaces live exactly as long as the loaded app, including reloads"); `effect-host/src/lifecycle.ts` |
| d | **the core code can be hot-updated** | **half exists**: plugins can `enable/disable/unregister` at runtime and a bundle can be loaded repeatedly; but there is **no versioned kernel artifact, no shadow/staging slot, no kernel↔app version negotiation** | `effect-host/src/lifecycle.ts:19-52`; `/-/planes/:id/(enable|disable)` `effect-host/src/control.ts:9` |
| e | the host **pushes upgrades** to **compatible** apps | **missing**: `abi: "effect-1"` is only declared and **no code validates it**; there is also no bundle distribution channel (agentd only pushes MCP config) | `effect-bundle/src/manifest.ts:9`; repo-wide `abi` appears only in the board manifest and a test fixture |
| f | a crash can be **rolled back** | **missing**: only the config-side "do not retry a failure"; there is no last-known-good version pointer; `.effect-bundles/` already holds two board versions at once but has no index | `apps/effect-server/src/boot/runtime.ts:33,38-44` (`failedReloads`); `.effect-bundles/io.effect-agent.board@{0.13.0,1.0.0}.effect-bundle` |

## 3. Three-way attribution (the main axis of this plan)

One app development = three attributions that **do not rewrite each other**:

```text
┌── Declaration ── the app author writes "pure data"
│     tools(zod) · routes · config schema · ui view · egress · requires
│     = the "source" of the operation set
├── Domain ─────── the app author writes the "imperative"
│     the handler implementation of each operation (business semantics)
└── Kernel ─────── we write it, it follows the SDK version
      register back/unregister · route dispatch · config parsing and hot-read · UI hosting · MCP/agent surface ·
      permissions(planes) · parity/observe · lifecycle(load/enable/upgrade/rollback)
      = the "generator + executor" of the operation set
```

**Rules**:
1. the app only declares + implements domain handlers; it **does not import kernel implementation details** (the boundary check already enforces this: `check-boundary.ts` R5).
2. the kernel is injected by **wrapping**, not by convention: `withAppRuntime` already has this shape — it wraps
   `plugin.load()`, automatically registering tools as interface and chaining `stop()` into "first withdraw the
   registration, then stop the app".
3. a change in kernel semantics = swap the kernel version; the app's declarations do not move (see §5).

## 4. The operation set: one vocabulary

Gather "everything that can be done" into one **node-level plane table** (following the four planes + privileged plane of `effect-planes-permissions.md` §1):

| Plane | Addressing | Content | MCP projection | Who may declare |
|---|---|---|---|---|
| interface | `ns::appId.tool` | zod-ified operations | `tools/list`/`tools/call` | app (domain) + kernel (generic) |
| ui | `ui://ns/appId/<view>` | language-neutral UiDocument | resources | app |
| storage | `store://ns/appId/<key>` | document-style KV | resources/templates | app (data) |
| config | `config://ns/appId` + `config_set` | schema-driven config | resource + write tool | app |
| **lifecycle (privileged)** | `ns::host.lifecycle` | enable / disable / unregister / **stage / activate / rollback** | host nodes only | **the kernel only** |

Key points:
- **host nodes and app nodes share the same table**; the only difference is the privileged plane: host nodes have
  lifecycle (upgrade/rollback), app nodes do not. This is where "host and non-host nodes included" lands.
- the operation set is **generated automatically** by the kernel from the declaration layer — this is what the user
  meant by "automatically carrying the behavior-pattern code with it".
- the existing implementation already does part of this: `listAppTools / resolveAppTool / invokeAppTool`
  (`packages/effect-apps/src/tools.ts:21-39`) provide **one uniform** list/resolve/validate/invoke entry point for
  all apps (the `apps_list/app_read/app_call` surface).

**Landed (2026-09-10, P2-A)** — the host privileged surface joins the same table, in three parts:
- **Declaration**: `packages/effect-host/src/operations.ts`. The four operations of `/-/planes` (list / enable /
  disable / unregister) used to be just a regex in `control.ts`; now they are `HOST_OPERATIONS` data, each entry
  carrying `method`, a `path` template, `inputSchema`, `outputSchema`. `control.ts` keeps only execution:
  `matchHostOperation` → `runHostOperation`. **This is not a new layer, it is writing down the layer that already
  existed** — the path shape now exists in exactly one place (a test pins that equation).
- **One table**: `packages/effect-apps/src/operations.ts`. `makeNodeOperationTable(host, apps)` puts the host's
  lifecycle and every app's interface tools into one `NodeOperation` table, addressed
  `${node}::${plane}::${name}` (on the host side `host::lifecycle::enable`; on the app side the node is itself
  `ns::appId`, so it looks like `ops::notes::interface::ping`). Privilege is **a property on the entry**
  (`privileged`), not a second table: only host nodes have lifecycle, apps never do.
- **Service**: `GET /-/operations` (`apps/effect-server/src/boot/infra.ts`) returns a JSON-safe projection
  (`nodeOperationSummary`, **without `invoke`**). Listing and doing are kept apart: this route only describes;
  acting still goes through the already-declared `/-/planes` path.

Two deliberate properties (both written in the `operations.ts` comments): `list()` is **a view, not a snapshot**; it
re-reads the catalog every time, so a hot swap (§6.4) is reflected immediately and there is no cache to invalidate —
the node MCP server being rebuilt per request is the same idea; and app-surface visibility inherits
`listAppTools`'s `authorize("interface")` directly, so a denied plane is **simply not in the table**, rather than
"in the table but not callable".

## 5. Kernel version and compatibility

**Today**: `bundleId` carries semver (`io.effect-agent.board@1.0.0`), the manifest has `abi: "effect-1"`, config has `revision` (`effect-config/src/contract.ts:43`, persisted in SQLite) — **but abi is never validated**.

**To be decided**:
- `abi` (major, the compatibility line, e.g. `effect-1`) — decides "can it be installed".
- `kernelVersion` (semver, the kernel itself) — decides "is the behavior the same".
- the app declares `kernel: "^1.2"` or `abi: effect-1`; **gate before load**, and if unmet, **refuse to load with an
  explicit error** (following the repository's stance: a structural mismatch fails loudly, it does not degrade silently).
- **two-way** kernel↔app compatibility: a new kernel must be able to run apps that declared an older abi; a new app
  declaring a kernel higher than the host's → refuse to install.

**Landed (2026-09-10, P0)**: `packages/effect-bundle/src/compat.ts` implements the gate above —
`KERNEL_ABI = "effect-1"` is the line the host implements, and `assessBundleCompat(declaration, host capability)`
returns `{ok}` / `{ok:false, reason:{code: abi-unparseable | abi-mismatch | runtime-unsupported}}`;
`loadEffectBundle` calls it **before** `import(entry)`, so an incompatible artifact **executes not a single line**.
An unrecognized abi (not `effect-<major>`) is judged `abi-unparseable` rather than quietly let through — following
the stance that a structural mismatch fails loudly.

**Two ABI lines (after the K2 decision, see §6)**:

| Line | Both ends | Change frequency | Decision |
|---|---|---|---|
| `bootstrap ABI` | host base ↔ kernel artifact | very low | the kernel declares the bootstrap ABI it needs; if unmet, refuse the kernel swap |
| `effect-N` | kernel artifact ↔ app artifact | medium | the app declares what it needs; the kernel declares the range it implements; **check every loaded app before swapping the kernel** |

**An existing precedent of the same kind of mechanism (reuse it, do not build a second one)**: `docs/script-sandbox.md` §4/§5 already implements a whole
**content-addressed versioning + graded compatibility adjudication**: four levels of breakage (schema / deps /
description / behavior), `CompatPolicy` configurable as `strict|warn|ignore`,
`assessUpgrade(store, from, to, policy): UpgradeReport`, and **upgrade and rollback go through the same adjudication
function** (§5.2 states it explicitly: *"Upgrade direction: old→new (apply the new version) and new→old (rollback)
use the same adjudication function"*). §0 summarizes this as *"one recursive mechanism"* — the tool level, version
level, config level and agent level all recurse on the one "scope + policy" pattern.
**Kernel↔app version compatibility and rollback adjudication should converge on this**, rather than setting up a
separate set of semver rules.

**Landed (2026-09-10, P4)**: this adjudication has been extracted into the **zero-dependency** `packages/effect-compat`
(`assessChange` / `assessUpgrade` / `assessRollback` / `defaultCompat` / `CompatPolicy`); both `packages/script` and
`effect-apps` take it from there, ruling out "a second one". The reason for extracting the package is dependency
direction: `packages/script` depends on the native `isolated-vm`, and the app layer should not drag that in just to
adjudicate. `assessRollback(from, to)` is `assessUpgrade(to, from)` — rollback is a reversed upgrade, a one-line
difference. The inputs are widened to the structured `AssessableTool` and `VersionLike<T>`, so the tool surface
(§4's operation set) and version artifacts (§5's bundle) can share the same adjudicator.

**Landed (2026-09-10, P2-B) — both lines are now part of the code**:
- `packages/effect-bundle/src/kernel.ts`: `KernelDeclaration` (`bootstrapAbi` + `abi` + `runtimes`),
  `assessKernelCompat` / `assertKernelCompat` / `KernelIncompatibleError`,
  **`assessKernelAgainst(kernel, apps, host)`** — the latter is exactly what §5 asks for, "check every loaded app
  before swapping the kernel": it treats **the kernel as the host** and runs the same `assessBundleCompat`,
  returning the list of apps this kernel version breaks (empty = all preserved).
- the decision logic is not duplicated: `assessAbiLine` / `assessRuntime` are shared by both lines, and
  `Incompatibility` gained a `line: "bootstrap" | "effect"` field — when something goes wrong the log shows
  directly **which line** broke.
- the tests pin two things: a kernel wanting `bootstrap-2` while the host only has `bootstrap-1` → refused
  (`abi-mismatch`, `line: bootstrap`); a kernel with `abi: effect-2` against a loaded `effect-1` app →
  `assessKernelAgainst` names them one by one.
- `apps/effect-server/src/boot/kernel.ts` declares this process's kernel, and `bootRuntime` gates **before creating
  any state**; a kernel can also be passed in through `EffectServerOptions.kernel` (the supervisor will eventually
  pass it in from the artifact repo).

## 6. Lifecycle: load / hot update / rollback (**K2 decided**)

**Decided (2026-09-10)**: the kernel itself is also a hot-swappable artifact, and the host keeps only a minimal
base. That is — "the kernel code can be hot-updated" means a real hot update, not "upgrade = restart the host".

### 6.1 Host invariants (never hot-swapped)

| Invariant | Content | Current state |
|---|---|---|
| process and entry | the process, socket/listener, the **route-table dispatch point** (the kernel is swapped, the entry is not) | `effect-network/src/listeners.ts` already has a managed listener |
| artifact repo | `.effect-bundles/<bundleId>@<version>/` + `kernel-state.json` (active/previous/abi/health) | the directory layout exists, the index is missing |
| supervisor | supervisor: stage → health check → atomic flip → commit/rollback → boot recovery | **missing** |
| bootstrap ABI | the host ↔ kernel contract (§5's two ABI lines) | **declared and exercised** (`effect-bundle/src/kernel.ts`, P2-B; since P5's second leg the supervisor really takes the kernel from the artifact repo, and a mismatch fires). What is **not exercised** is tier ② — see below |

Everything outside the table above — plugin host, the various registries, config runtime, UI hosting, planes,
observe, the MCP surface, console — is a **kernel artifact**. Today's `apps/effect-server/src/boot/runtime.ts:17-72`
is exactly this "kernel + base" hybrid, and K2 requires **splitting it apart**: the base stays in the host, the rest
becomes a kernel bundle. **Split done (P5's second leg)** — see below.

**A correction the implementation forced (2026-09-10, P5's second leg)**: when we actually went to split it, doing
the sentence under the table above literally turned out to be **impossible**, and one criterion had to change:

> **A kernel is code. Anything holding a process-level handle is not.**

- the SQLite store and the listener are two of the three "process-level live handles" P1 named in §7.6. Putting them
  in the kernel would mean a compatible hot swap tears these handles out by the root — and that is precisely what
  §7.6 says "really blocks tier ①". So they are **services**: bootstrap creates them once and hands them to every
  kernel revision.
- **the app registry (plugin host) must also be a host invariant**, and this one is hard: if every kernel brought
  its own host, swapping the kernel would throw away every loaded app along with it — that is §6.3-**②** (a full
  rebuild), and the user stated explicitly that **a compatible kernel must not force apps to be rebuilt**. An app
  registers with that stable host once; the kernel owns only its own planes.
- so "kernel artifact" = **behavior** (the plane implementations + the logic that composes them), and "host" =
  **state and handles**. This also explains the phrase "and hand over the kernel's own runtime state" in §6.3-①: in
  this version it **holds automatically**, because the runtime state is already in the host's hands; if some future
  kernel has its own state, the handover will have to be really done — **that is when the gap appears**.
- in code: `KERNEL_PLANES` (slot id and priority) is **the host's data**, `planeStandIn` registers once per slot and
  never re-registers (the route table does not move); the flip is the single pointer inside the stand-in.

**Keep landed (2026-09-10, P2-B) and not landed apart**:
- what landed is the **contract**: the kernel now declares which bootstrap line it wants and which `effect-N` line
  it implements for apps, and `bootRuntime` gates before opening the database (`assertKernelBootable`). The decision
  uses the same set of functions as §5.
- **what did not land is "the kernel loading as an artifact"**. This step was deliberately deferred to P5: a
  hot-swappable kernel needs the supervisor (stage → health check → atomic flip → commit/rollback) beside it,
  otherwise the kernel swap is exactly the window §6.3-① explicitly forbids (the new kernel is already visible, the
  old kernel is already unloaded, and a failure can only be patched by rebuilding). So P2 only assembles the
  **material**; it does not introduce a kernel hot swap on its own.
- therefore `assertKernelBootable` today **cannot fire on a real mismatch**: host and kernel come out of the same
  build, so the constants on both sides are necessarily equal. It becomes a real gate at the moment the supervisor
  can take **another** kernel out of the artifact repo (P5/P6).

### 6.2 Double-buffered swap (kernel level)

```text
        ┌── kernel A (active, serving) ───────────────────────────┐
host ───┤                                                         ├─ route dispatch point (single, does not move)
        └── kernel B (staged, loaded but not taking the routes) ──┘
   stage B ─► compatibility matrix (§5's two lines + every loaded app) ─► health check
        ├─ failure ─► drop B; A keeps serving, **unnoticed**
        └─ pass ─► atomic flip of the dispatch point ─► A enters draining ─► commit (A becomes previous)
                     └─ exception after the flip ─► **flip back to A** (A is never unloaded before commit)
```

**The core invariant: A is never unloaded before commit**. That is the antidote to "the old kernel is already
unloaded, so it cannot be rolled back", and it is the one place K2 is genuinely harder than K1 — K1 sidestepped the
problem; K2 has to solve it head-on with double buffering.

**Landed (2026-09-10, P5-1) — the state machine and the pointer, not wired up**:
- `packages/effect-bundle/src/repo.ts`: the artifact repo index `kernel-state.json` (active / previous / condemned).
  The write to disk is **atomic** (temp file + rename) — crashing halfway through would lose both active and the
  rollback target at once, worse than a stale index. A missing file = an empty repo (first boot); **a corrupt file =
  an error**; it does not guess which kernel to run. `condemned` records the revisions that have already failed on
  this machine: no retry, avoiding the "boot → crash → fall back → boot again" loop.
- `packages/effect-bundle/src/supervisor.ts`: `makeKernelSupervisor({repo, load, activate, probe, apps, host})`,
  giving `boot(shipped?)` / `stage(revision)` / `state()` / `active()` / `previous()`.
  The order follows §6.2 strictly: `stage → §5 matrix → load → probe → activate (flip) → persist → dispose(A)`.
  If the flip itself throws, A is **put back in front** — A never stopped, so "putting it back" cannot fail for any
  reason introduced by this swap.
- the kernel is the generic `K`: this state machine cares about revisions and pointers, not about what a kernel is.
  `load` is injected; today it returns this repository's kernel, in future it returns a compiled artifact — **the
  swap logic does not change**.
- what the tests pin is the invariants themselves: the flip happens **before** the old kernel stops (asserting
  `activate:B` precedes `stop:A`); a rejected candidate **executes not one line**; a candidate that fails its
  physical only drops the candidate; a failed flip flips back to A; boot falls back to previous and warns; a
  revision already condemned is not retried next time.

**This one was not done, to be clear**: the supervisor **is not yet wired into `bootRuntime`**. Wiring needs both a
"stable facade" (§6.3-①: what the host hands the app must be a facade, not the kernel's concrete objects) and
request protection during the swap (§6.5-5); otherwise `activate` can only be a no-op — and a double buffer built
on a no-op is self-deception. Also, today `load(revision)` builds the same kernel for any revision (the kernel is
not yet an artifact), so in a real process "fall back" has nothing to fall back to. Doing both together is what
keeps it from being theatre: that is P5's second leg (kernel artifact-ization + facade + request protection).

> **That paragraph is the state at P5's first leg; P5's second leg (2026-09-10) has filled it in**: `activate` is now
> a single pointer assignment in `dispatch-point.ts`, `load(revision)` will `import()` a kernel from an **artifact
> directory**, and `retire` waits for the old kernel's in-flight requests to finish before letting it stop. The
> diagram below and the paragraph above record two points in time of the same thing; the original text is kept so
> that "why it was deferred at the time" is not erased.

**Landed (2026-09-10, P5's second leg) — wired into the real process**:
- the dispatch table does not move: every slot of `KERNEL_PLANES` has a **stable stand-in** on the host, registered
  once, with the id and priority belonging to the host. On a kernel swap the route table **does not move by a
  single byte** (the literal fulfilment of §6.3-①).
- the flip: the stand-in's `handle` goes through `point.run(...)`, grabbing whichever kernel is current on entry.
  So "requests already in service finish on A, new requests land on B" is **a mechanism**, not a promise.
- the old kernel's stopping point: `dispose: (kernel) => { await point.retire(kernel); await kernel.dispose() }`,
  and `retire` **refuses** to retire the kernel currently in service — "flip first, then stop" went from a comment
  to a constraint that throws.
- during stage there is also a host-side check: the candidate kernel must **fill every enabled slot** (`probe`).
  One unfilled slot means the route table has a URL-reachable hole — it has to be refused while the old kernel is
  still serving, not when the first request lands in the hole.
- the state of the two tiers: **both tiers now work**. ① a compatible in-place hot swap is a pure translation;
  ② incompatible → rebuild the apps has also landed (2026-09-10, see "tier ② landed" in §6.3). **Tier ② is available
  only when the host injects the `rebuild` capability**; a host that does not inject it behaves word-for-word as
  before (refuse the swap).

**The two tiers cost completely different things**: a compatible kernel's flip is only a replacement of the
implementation behind the facade (§6.3-①, **apps do not move**); only an incompatible one goes through a full
rebuild (§6.3-②).

### 6.3 The two tiers of a kernel hot swap: in place when compatible, rebuild the apps only when not

**User clarification (2026-09-10)**: *a compatible kernel does **not** need an app rebuild — just hot-update the kernel (remotely)*.
So the rebuild flow below is not "the only workable model" but the **second tier**:

| Tier | Condition | Action | Effect on apps |
|---|---|---|---|
| **① in-place hot swap** | the kernel is **compatible** (abi unchanged **and** the kernel's own runtime state is handover-able) | the host swaps the implementation bound behind the facade from A to B, and hands over the kernel's own runtime state | **zero rebuild**; the app's loaded planes do not move |
| **② full rebuild** | the kernel is **incompatible** (abi changed / the kernel's internal state structure changed / some app grabbed a concrete kernel object) | `drain(apps) → unload(apps) → load B → B replays the declaration layer's registerEffectApp → health check → commit` | all apps rebuilt |

**The mechanism tier ① rests on**: **what the host hands the app must be a stable facade, not the kernel's concrete
objects**. `EffectBundleApi` (`effect-bundle/src/load.ts:20-31`) and `EffectAppHost`
(`effect-apps/src/descriptor.ts:29-40`) **are that facade seam**. The app takes only the facade; the kernel is
plugged and unplugged behind the facade, so "swapping the kernel" = swapping the binding, and neither the app nor the
route table's contents move. This is also the **runtime counterpart** of §3 rule 1 (the app does not import kernel
implementation details): no imports at compile time, no grabbing objects at runtime.

**Why tier ② is workable**: the declaration layer is pure data, domain handlers are re-imported from the bundle, and
state is in SQLite / the config store; and "an instance interface's lifetime matches the app's exactly, reloads
included" is already the existing semantics (`registration/runtime.ts:6`).
(`packages/effect-apps/src/registration/runtime.ts:6`, the comment says explicitly *including reloads*).
**The precondition**: during the swap window the apps' in-memory state must be rebuildable — whichever app has
in-memory state that cannot be rebuilt is what this architecture rework's checklist is for.

**Tier ② landed (2026-09-10)** — both tiers are now in place:

- **On the supervisor side** (`packages/effect-bundle/src/supervisor.ts`): a new injected capability
  `rebuild?: { teardown(); replay() }`. The supervisor is generic in K; it does not know what an app is, and
  **loading and unloading apps is the host's business** — the same division of labor as its participating in the
  matrix today only through `apps(): BundleDeclaration[]`. When injected, it runs
  `teardown → adopt(B) (load+probe) → activate(B) → replay → persist → dispose(A)`;
  **when not injected, it is word-for-word as before** (refuse the swap) — ② is a capability, not a default.
- **which refusal triggers ②**: only `apps` (the effect line) refusing goes to a rebuild. `incompatible` is the
  host↔kernel bootstrap line, and **rebuilding apps cannot save a kernel that cannot run on this machine**, so even
  with `rebuild` injected it is still refused.
- **every step's failure goes back to A and puts the app layer back**: `adopt` fails → replay the apps (A never
  stopped); `activate` fails → dispose B, switch back to A, replay; `replay` fails → switch back to A, dispose B,
  **try the replay once more**, and if that fails too, throw and say plainly "this node needs a restart". This is
  not decoration: **reporting a rollback that looks successful is worse than the failure itself**, so the
  `rebuild-failed` event carries `restored: boolean`.
- **§6.2's core invariant still holds in ②** (A is never `dispose`d before commit), and that is why every failure
  above has a way back. But ②'s window really is longer than ①'s, and this is **recorded honestly, not papered
  over**: the app layer goes offline **before** the flip (the test asserts exactly this order:
  `load:demo-app → stop:demo-app → load:B → load:demo-app`).
- **Product wiring** (`apps/effect-server/src/boot/runtime.ts`): `rebuild.replay` is simply **running
  `bootManifests` again**, the same path as boot — the rebuilt app set must not come from a thinner registration
  path that would drift from the first one; `teardown` disposes the existing `disposers` in reverse order.
- **The third disposition landed (2026-09-10)** — "**suspend only** the incompatible apps": `rebuild.teardown/replay`
  take a **subset of names** (the ones the matrix named), and the ones that can live are **not touched once**.
  Three convictions are written into the implementation: suspending **keeps the slot** (returning puts it back in
  place, and `stop()` still tears down in reverse load order); the matrix judges **loaded**, not **discoverable**
  (a bundle on disk that is not enabled declares nothing); and an artifact whose `appId` and the `effect.yaml` `id`
  **disagree is refused outright** (otherwise it would suspend the wrong one).
  Record honestly where today's gain comes from: the matrix names only apps that **made a declaration**, so what
  survives today is exactly those apps that **carry no `effect.bundle.json`** — "a declaration nobody made is not a
  declaration". Tier ② used to tear them all down; this unit removes that collateral damage.

### 6.4 App hot swap (single point, an **independent goal**)

**Requirement (user, 2026-09-10)**: besides the kernel, **the app itself must also be hot-updatable**. This is not a
by-product of the kernel swap — the two have different blast radii:

| | Kernel hot swap (§6.2) | **App hot swap (this section)** |
|---|---|---|
| Blast radius | **all** apps rebuilt with the kernel | **a single** app; the others are uninterrupted |
| Triggered by | host / supervisor | the host, or the app's own release process |
| State | entirely from replaying the declaration layer + the store | the two versions **share one store**, so continuity is stronger |
| Window | longer (full rebuild) | very short (one registration replacement) |

**Flow**: `stage(appId@v2) → health check (against the same store) → atomically replace that app's route/interface registration → drain v1's in-flight requests → dispose v1`.

**Existing primitives show a single-point hot swap was the SDK's design intent all along**:
- `registerMap` compares **generation tokens** rather than values; the comment says explicitly *"Track generations,
  not just values: replacement HTML/UI may be identical"* (`packages/effect-apps/src/registration/metadata.ts:6-18`)
  — **this is exactly what a single-point hot replacement of UI/HTML needs**.
- `withAppRuntime` binds the scope of the interface registrations to that app's loaded lifetime, and on `stop` it
  withdraws the registrations before stopping the app (`registration/runtime.ts:12-17`) — on a single-point reload
  the tools automatically re-register correctly.
- `host.unregister(id, expectedPlugin)`'s identity check guarantees that "replacing v1 will not delete v2 by
  mistake" (`effect-host/src/lifecycle.ts:11-17`).

**Three things that must be solved together**:
1. **Tool-surface compatibility**: if v2's tool schema changed, an agent currently holding the old schema will come
   up empty. Use §5's graded adjudication (schema breakage = `strict`) to decide pass / warn; and notify connected
   parties through **MCP `notifications/tools/list_changed`**.
2. **The two-versions-coexist window**: during the drain v1 and v2 exist at once; should `namespace` carry the instance/version (echoing §10-Q9).
3. **The rollback granularity must go down to a single app**, not just the kernel (see §6.5-7).

**Landed (2026-09-10, P4)** — two halves, in two packages:

- **Generation slot** `packages/effect-apps/src/registration/generations.ts`: `makeAppSlot(host, appId, {onChange})`
  gives `install / rollback / unload / current / previous / generations`.
  The flow is `install → read back the tool surface → adjudicate → health probe → commit (retire the old
  generation)`, and any step's failure **restores the previous generation**. The adjudication uses
  `assessSurfaceChange` (a tool with the same name in both generations goes through `assessChange`; a tool that
  **disappears** counts as the `schema` level; a tool that is **added** is not breakage).
- **Tool surface**: no reconciliation is needed. `registerTools` registers once from the registry it is given, and
  **every HTTP request builds a fresh MCP server** (both `effect-standalone`'s HTTP face and `apps/effect-server`
  work this way), so after a hot swap the agent gets the new server's list; there is no "connected agent holding a
  stale list", and therefore no `notifications/tools/list_changed` to send.
  **Correction (2026-09-13)**: there once was a `ToolSurface.refresh()` reconciliation plus a `NodeMcpServer` type,
  with the seam written on `makeAppSlot`'s `onChange` — but that seam was never wired, and "fresh per request" is
  already the simpler solution to the same problem (`packages/effect-apps`'s `list()` is "a view, not a snapshot",
  the same technique). Deleted. After the deletion `registerTools` keeps one **loud failure**: when two tools
  sanitize to the same name it throws and names both keys, rather than letting the later writer silently overwrite
  (`formal/Formal/ToolKey.lean`'s `two_names_can_serve_as_one_name` and `a_shared_name_stops_the_surface`).

**Deviation from §6.5-1 "staging slot" (recorded honestly)**: no "shadow identity" was built (the `id#staged` kind
of staging that does not take over the routes). Reason: `effect-host`'s `register()` already **overwrites by id**
(`lifecycle.ts:26` unloads the old one before installing the new one), and every disposer is identity/generation
guarded (`registry.ts:83`, `metadata.ts:6-18`), so "install the new version" is itself the switch point.
The cost is that **a window exists**: v2 is already visible, the adjudication and probe have not passed, and v1 has
already been unloaded — a failure is patched up by restore, not by "the old one never went offline".
That is exactly the kind of window §6.3-① wants to avoid, so it **cannot be used directly as a kernel hot swap**
(a kernel hot swap still needs §6.2's A/B double buffer). To be decided: see §11-Q3 / Q15.

### 6.5 Primitives to be added

1. **Staging slot** (shared by the kernel level and the app level): a shadow identity that is `register`ed but
   **does not take over the routes** (such as `id#staged`).
   *Landed at the kernel level, but no shadow identity was needed*: `supervisor.stage()` is by nature "load into a
   slot and **do not touch the dispatch point**", and the flip is one explicit pointer assignment (§6.2). The app
   level cannot do this, because an app's switch point is `register` itself (see the deviation note in §6.4).
2. **Health check hook**: `LoadedPlane` gains an optional `health?()`; without it, this degrades to "load did not
   throw + a smoke request".
   *Landed at the app level* as `InstallOptions.probe(generation)` (without depending on a `LoadedPlane` reshape).
3. **Artifact repo index + active/previous pointer**: `kernel-state.json`, recorded for both kernel and app.
   *The kernel half has landed* (`effect-bundle/src/repo.ts`, P5-1: active/previous/condemned + atomic write);
   **the app side is not done** (`AppSlot.previous()` still lives only in memory).
4. **Boot-time crash rollback**: if the active artifact fails to load → start from previous + warn.
   *Landed and wired into the real process* (`supervisor.boot()`, P5-1; `main.ts` passes
   `.effect-bundles/kernel-state.json`, P5's second leg) — a bad revision goes into `condemned`, so the same
   failure is not replayed on every boot, and the fallback result can be read from `kernelBoot()`.
5. **Request protection during the swap**: the dispatch point's flip is atomic, but the app layer's rebuild is
   **not**; requests inside the window must queue or fall back to A.
   *Landed* (`packages/effect-host/src/dispatch-point.ts`, P5's second leg): `run` grabs the current target on entry
   and counts it, `retire` waits for it to reach zero, **and refuses to retire the kernel currently in service**.
   What the test asserts is the real property — with the flip committed and new requests being answered by the new
   kernel, the old kernel is still answering the one in-flight request it holds, and only then is it `dispose`d.
   Note that it protects the **kernel-level** flip; the app-level rebuild window (§6.4's deviation) is not in it.
6. **Compatibility matrix adjudicator**: the `effect-N` range the kernel declares it implements × each loaded app's
   requirements → pass / refuse the swap / suspend only the incompatible apps.
   *All three halves have landed*: the single-artifact half is `effect-bundle/src/compat.ts` (P0), the kernel × all
   apps half is `assessKernelAgainst` (P2-B), and **the third disposition has landed (2026-09-10, see §6.3 and the
   acceptance block below)** — the matrix hands out a subset of names and the app layer suspends and returns them
   by name.
   (Since P5's second leg the matrix really runs on the `stage` path, reading the declarations of **loaded** apps
   rather than apps discoverable on disk; today only artifact-ized apps have declarations, so the list is short —
   **a declaration nobody made is not a declaration**, and it is exactly these apps that escape the collateral
   damage.)
7. **Per-app active/previous pointer**: rollback granularity down to a single app (§6.4-3).
   *The in-memory version has landed* (`AppSlot.previous()` + `rollback()`); **persistence across restarts is not
   done** (see item 3).
8. **MCP `notifications/tools/list_changed`**: after an app (or kernel) changes version, notify connected agents
   that the tool surface changed.
   *Not needed*: the node server is rebuilt per request, so what the agent gets is the current list. The
   notification is for servers that "hold a connection for a long time and whose tool table changes in place";
   there is no such server here. The former `ToolSurface.refresh()` has been deleted (reason in §6.4's correction
   note).

### 6.6 Existing reusable pieces (assemble, do not build from scratch)

- `host.register/unregister(id, expectedPlugin)`: `expectedPlugin` does an **identity check**, which naturally
  prevents "deleting the wrong generation" (`effect-host/src/lifecycle.ts:11-17`) — exactly what a double-buffered
  swap needs.
- the lifecycle queue serializes every change (`queue.ts`); change races are already handled.
- registration is rollback-ready: `registerEffectApp` fails → `rollback(error, dispose)` cleans up in reverse order
  (`registration/register.ts:34-36`, `disposal.ts`).
- bundle load = `import(entry)` + `register(api)` + an **idempotent disposer** (`effect-bundle/src/load.ts`'s
  `loadEffectBundle`).
- a boot failure disposes the loaded entries in reverse order (`load-manifest.ts:19-25`) — the rollback order is already right.
- `EffectBundleApi` (`load.ts`) is the **host↔app seam**: the host hands it to the bundle and the app uses it to
  register itself.
  **Correction (2026-09-10, P5's second leg)**: it is **not** the host↔kernel seam — that is not what the kernel
  gets. The kernel's seam is `KernelContext` in `apps/effect-server/src/kernel/types.ts` (the **services and
  handles** the host gives the kernel) and `KernelInstance` (the **load surface** the kernel hands back):
  `loadKernel()` uses `import()` to load the artifact and requires it to export `createKernel(context)`. The two
  seams being separate is exactly where §6.1's correction lands.

## 7. Runtime portability: OS / browser / JS sandbox

**Requirement (user, 2026-09-10)**: apps are distributed, so **the same app artifact must be able to run in an OS
process, in a browser, or in a JS sandbox**; the sandbox is lighter.

### 7.1 Three runtime targets

| Target | Host | Can provide | Cannot provide |
|---|---|---|---|
| **os** | the effect-server process (Bun/Node) | fs, SQLite, socket/listener, child processes, crypto | — |
| **browser** | a page / Worker | fetch, IndexedDB/localStorage, WebCrypto, MessageChannel, DOM | fs, child processes, listening ports |
| **sandbox** | a restricted JS runtime | **only the injected capability objects** | everything ambient (network and storage included) |

### 7.2 The one rule: capability injection, not ambient

An app can only reach the world through **injected capabilities**. **The repository already enforces this rule**:
`scripts/check-boundary.ts:213` judges `Bun.serve/spawn/file`, bare `fetch`, `WebSocket` and `process.*` as
**error**, and `bun run check:boundary` is currently 0 error — that is, **apps that are not exempted are portable by
construction**.

**Debt (measured, see §7.6)**: `effect.boundary.json`'s `ioExemptApps` exempts 6 of them (board, mantis,
deckconsole, ui-host, ai-gateway-app, playground). They call `Bun.serve` / read files directly and **cannot run in a
browser/sandbox by construction**. This is the existing debt list under the "portable" requirement. Note that the
exemption list and the measurement **do not fully coincide**: `playground` is exempt but does not touch system APIs
in the measurement, while `effect-server` has ambient dependencies yet is not on the exemption list (it is the host,
it goes through `allowSystemIoFrom`). That is — **the exemption list is policy, not evidence of capability**.

### 7.3 Four pieces of groundwork that already exist

1. **ABI kept external**: `compileEffectBundle` uses `--external @effect-agent/* --external zod`
   (`effect-bundle/src/compile.ts`), meaning "a bundle can run in any host that provides these" —
   **this is exactly the mechanism that lets the kernel be hot-swapped without recompiling the app**, and the
   precondition for "the same app, a different runtime". At the time the target was hard-coded to `--target bun`;
   **P3 emits several, per `runtimes`** (see §7.5-2).
2. **Storage already sits behind a protocol**: `store://ns/appId/<key>` + `NodeStore`
   (`effect-planes-permissions.md` §3) turn "storage" into **a proxiable capability** — SQLite on OS, IndexedDB in
   a browser, and **in a sandbox with no local storage, proxied back home**. So §6.3's "in-memory state must be
   rebuildable" has to be upgraded to **"must also hold across runtimes"**.
3. **A sandbox already exists**: `packages/script` has a real sandbox execution model
   (`ScriptRuntime.runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"`, see `script-sandbox.md` §2), and
   `packages/ui-sandbox` wraps it into a **permission-gated** `UISandbox`
   (`execute:script` / `read:data` / `render` / `emit:event`, `ui-sandbox/src/index.ts:9`).
   Today it carries **script tools**, not a whole app — it needs to be extended so that "an app can run in a sandbox
   too".
4. **A browser host already has a precedent**: the console's client bundle
   (`apps/effect-server/public/effect-ui-client.js`) already runs in the browser; `effect-bundle-mesh.md` §5's
   P3-lite has already done "the board bundle registering back inside a browser host + meshing to `ops::board`".

### 7.4 Intersection with K2

- kernel artifacts must also be emitted per runtime; **on a swap the target runtime must match** (a browser kernel cannot be installed into an OS host).
- push upgrades (§8) gain one more matching dimension: `abi` × `runtime` × version range. If the target host's runtime is not in the set the app declares, **refuse the push** (a mismatch fails loudly).
- note that `IsolatedVmRuntime` is a native module and **bun cannot load it** (`script-sandbox.md` §2 says so explicitly; it degrades automatically to `NodeVmRuntime`) — the **actual isolation strength** of the "sandbox" tier depends on the host, and must be declared honestly in the manifest; a uniform sandbox level cannot be claimed.

### 7.5 Gaps

1. ~~the manifest gains `runtimes: ["os"|"browser"|"sandbox"]` (a **second compatibility dimension** alongside §5's `abi`)~~ ✅
   landed (`packages/effect-bundle/src/compat.ts`; default `["os"]`, gate before load).
2. ~~`compileEffectBundle` supporting multi-target output~~ ✅ **landed (2026-09-10, P3)**:
   `compile.ts`'s `targets` / `BUILD_TARGET` / `entryFor(runtime)` emit one `entry.<runtime>.js` per `runtimes`
   the manifest declares, written into the artifact manifest's `entries`; `entry` stays as the main output
   (`os` preferred), and **old artifacts (no `entries`) load as before**.
   **One deviation from the original plan**: it said three tiers, "bun / browser / neutral", but there are only two
   in practice — `sandbox` and `browser` share `--target browser`. The reason is that the difference between a
   sandbox and a browser is **not in the bytes produced** (both are on the "no node builtins" side) but in **what
   the host injects**; opening a separate compile tier for it that only changes the label would be decoration.
3. ~~Runtime adaptation layer~~ ✅ **landed (2026-09-10, P3)**. The capability vocabulary and the decision live in
   `packages/effect-bundle/src/capabilities.ts` (`CAPABILITY_NAMES` = clock / storage / crypto / network,
   `capabilitiesOf`, `describeCapabilities`, `requireCapability`, `capabilityGaps`), and the **constructors** live
   in the same package's `packages/effect-bundle/src/runtime.ts`:
   `ambientCapabilities(runtime, overrides)` (os | browser: a real clock + WebCrypto, storage defaulting to process
   memory) and `sandboxCapabilities(injected)` (**nothing ambient** — a clock that was not injected does not exist,
   even if the process has one). Two constructors rather than three: os and browser differ in "what can be
   provided", not in how the seam is built.
   **The reason for the split is dependency direction**: the loader (`effect-bundle`) must refuse before the import,
   so the vocabulary and the decision belong to `capabilities.ts` and the constructors to `runtime.ts`; the loader
   does not import the constructors, so "decide before loading" is guaranteed by a file boundary and does not need
   the package boundary to hold it up.
4. **A sandbox carrying a whole app**: **half landed (2026-09-10, P3)**. The host half is there —
   `loadEffectBundle` accepts `runtime: "sandbox"` + `capabilities`, and an artifact can load, execute and return a
   disposer inside a sandbox host; the `requires` declaration and the `capabilityGaps` refusal gate land in `load.ts`
   (**the same place** as §5's abi/runtime gate, `assertCapabilityCompat` right next to `assertBundleCompat`).
   **Still missing**: real isolated execution — today the entry still runs in the host process, and "sandbox" is
   **about capability**, not **about isolation**. For it to be real, `packages/script` (quickjs / graaljs / node-vm)
   has to be wired in as a host, and the isolation strength declared honestly per §7.4.
5. the browser-side storage backend (IndexedDB) and where "storage proxied back home" lands.
6. **There is still no real page host on the browser side**: `ambientCapabilities("browser", …)` provides a
   browser **capability set**, but nothing has ever actually put an entry into a page and run it. So P3's acceptance
   for "os and browser behave identically" was produced by **swapping capability sets inside one process** — the
   capability seam is real, the page is not. This also settles where §7.5-5 lands: an IndexedDB backend needs a page
   to sit in first.

### 7.6 P1 inventory conclusions (measured, 2026-09-10)

The automated part is generated by `bun run inventory` into **`docs/app-portability-inventory.md`** (reviewable,
re-runnable), with `bun run check:inventory` as the gate. The measured conclusions:

| Fact | Number |
|---|---|
| apps in total | 10 |
| have ambient dependencies (can only run `os` today) | 6 — ai-gateway, board, deckconsole, effect-server, mantis, ui-host |
| do not touch system APIs in code | 4 — agentd, mcp-gateway-app, mcp-registry-app, playground |
| artifacts that declare `runtimes` | 1 — board = `["os"]` |

**"Does not touch system APIs" ≠ "can run in a browser / sandbox"**: it only says that it does not touch them
directly; a package it depends on may, or it may use semantics that only hold on OS. After P3 this criterion
**has a sample that actually runs**: `fixtures/app-portable` really loads and executes on all three tiers, os /
browser / sandbox (§7.5, §10 P3). But it is a **fixture written specifically for portability**, not any of the 10
apps above — **the inventory's own conclusion is not overturned by that**: those 6 apps' ambient dependencies are
still there.

**Non-rebuildable state** from the manual review (the precondition for §6.3-②; a script cannot find it, only a human reading can):

| app | Fact | Meaning for a kernel hot swap |
|---|---|---|
| board | **the only app loaded as a bundle** (`src/effect-bundle-entry.ts` → `registerEffectApp`); `storage/database.ts:9` opens SQLite | state is already in the database and the in-memory state is rebuildable. The real risk is **handles**: on tier ①'s in-place kernel swap, if the new kernel reopens the same SQLite file there are two writers — either reuse the old handle or wait for the drain and then hand it over |
| mantis | what is registered on the platform is only a **declarative facade** (`src/effect-app.ts:11` — just config + UI). The DingTalk worker / webui panel are **separate processes** (pm2-managed), and their `setInterval` (`hosts/webui/panel/store/panel.ts:16-31`) and module-level `let host` (`hosts/dingtalk/main.ts:22`) **do not take part in the kernel swap** | a kernel hot swap costs the mantis facade nothing; but those two processes are also **outside the governance scope** — bringing them in has to wait for §8's container nodes |
| agentd | `src/effect-plugin.ts:7,19` module-level `let runtimeControl` + a `??=` memoized singleton | **a process-level live handle**: on tier ①'s in-place kernel swap it still points at the old kernel object — exactly §6.3's instance of "an app grabbed a concrete kernel object" |
| deckconsole / ui-host / ai-gateway | each opens SQLite (`ui-host/src/activity.ts:17`, `deckconsole/src/domain/launchers.ts:15`) or calls `Bun.serve` directly; **none has an `effect.bundle.json`** | today they are **not inside the bundle lifecycle**, and §6's swap mechanism cannot reach them — P2/P3 must bring them into artifact form, otherwise "push upgrades" only covers board |
| effect-server | the host itself (goes through `allowSystemIoFrom`) | falls under §6.1's host invariants; it is not the thing being hot-swapped |

**This review's conclusion is more concrete than expected**: what really blocks tier ① is not "the state is in
memory" — the state is basically all in SQLite / `store://`; it is **three kinds of process-level live handle**: a
SQLite file handle, a native timer, and the kernel object a module-level `let` points at. They are exactly the three
failure modes of §6.3 tier ①'s precondition, and they directly support §11-Q18 (how to hand over kernel runtime
state). The second conclusion is coverage: **today the bundle mechanism covers 1 of the 10 apps**; for "push
upgrades" to become a platform capability, the rest of the apps have to be brought into artifact form first (§10's
P2/P3).

## 8. Container nodes: one node carrying several apps

**Requirement (user, 2026-09-10)**: support **container nodes** — one node (machine / container / host) can **carry the deployment of several apps**.

### 8.1 What a node is made of

```text
container node (machine / container / browser host / sandbox host)
├── bootstrap       host invariants: process · listener · artifact repo · supervisor · bootstrap ABI  ← §6.1
├── kernel artifact  one per target runtime; hot-swappable                                            ← §6.2 K2
└── N app instances
     ├── app@v1   ns=ops/board
     ├── app@v2   ns=workspace-b/board     ← several instances of the same app (different ns)
     └── other-app
```

Inside a node each app instance does `stage / activate / rollback` independently (§6.4) and they do not affect each
other; the node as a whole **is only fully rebuilt on an incompatible kernel hot swap** (§6.3-②) — a compatible
kernel is swapped in place (§6.3-①) and the node's apps are unaffected.

### 8.2 Existing counterparts (do not build them again)

| Existing | Reused as |
|---|---|
| agentd **Machine** (machine identity, online status, the config scope it may be sent) | a container node's identity and online status |
| board-v2's **probe** (a resident probe on the target machine, pull-based command channel, NAT-friendly) | the host program on a node — **landed**: `packages/agentd-probe` + `bun run node:probe`, outbound only, see §8.5-1 |
| mesh's node = `(namespace, bundleId, endpoint)` | addressing an app instance inside a node |
| effect-bundle's **namespace override** ("one bundle can be loaded several times, each landing in a different ns → several instances of the same app coexist", `effect-bundle-mesh.md` §3) | deploying several instances of the same app |
| mcp-registry's announce / heartbeat / withdraw lease | a reusable shape for node registration and keep-alive (**reuse the shape, not its `static` lease**: being registered in the config is not being alive — see §8.5-1) |
| K2 host invariants + kernel hot swap (§6.1/§6.2) | upgrading a node's base |
| app hot swap (§6.4) | upgrading and rolling back a single app inside a node |

### 8.3 What a node must declare

- `runtimes` (os / browser / sandbox) — decides **which apps this node can install** (§7.4's second compatibility dimension).
- `namespaces` — the isolation domains it is allowed to carry.
- capacity limits and resources (CPU/memory/disk, an app-count ceiling, quotas) — **the app-count ceiling is
  decided**; CPU/memory quotas and "should there be **scheduling**" are still open (§11-Q17).

**Landed (2026-09-10, §8.3 / §11-Q17)** — a declaration is no longer just a record, it is **admission**:

- shape: `Machine` / `DeclaredMachine` gain `namespaces: readonly string[]` and an optional `maxApps?: number`
  (`packages/agentd/src/types.ts`). The two tiers of strictness follow the split already established in §8.5-1: it
  may be omitted in the config file (omitted = carries nothing), and `namespaces` is required in the announce shape.
- **there is exactly one rule, and it lives in the node plan**: `packages/agentd/src/capacity.ts`'s
  `admitApps(node, apps)`, called by `makeNodeArtifactAdapter().plan()` **before** the compatibility adjudication.
  The allowlist **refuses** by default: a node that did not declare `namespaces` carries nothing; the refusal
  message names which domain, and what the node **does** declare
  (`node node-1 does not carry namespace "workspace-b" for board; it carries ops`) — "invalid placement" is not an
  actionable message for an operator.
- **why not in `bindNode`** (this is a deviation from this document's original plan, for a measured reason):
  `announceNode` **overwrites** the machine record, so a node can withdraw its declaration **after** the binding was
  written. A rule written at the binding would keep handing out a deployment the node has already denied; written
  at the plan, what is read is the **current** declaration. `apps/agentd/test/node-admission.test.ts` is the proof —
  not one word of the binding moved, and one announce turned the same plan from 200 into 400.
- **an absent `maxApps` ≠ 0**: a node that did not declare a ceiling reads as "declared no ceiling", reported
  honestly; the platform does not invent a number for it. `0` is a different declaration — a node being drained
  takes no apps. The schema therefore **gives `maxApps` no default** (§11-Q17's answer).
- the count comes **after** the domain check: the operator sees the first thing that is actually wrong with this deployment, not the second.
- the `runtimes` dimension does not move: it is still adjudicated by the SDK's own compatibility gate
  (`assessBundleForMachine`). `capacity.ts` only adds the two ceiling matters that are **unrelated to
  compatibility and related only to the node's own declaration** — which is exactly why it can refuse a placement
  before the artifact even exists.
- on the probe side: `bun run node:probe` gains `--namespaces a,b` (**required**; missing means it refuses to
  start) and `--max-apps n` (optional). The reason for requiring it is isomorphic to `--capabilities` but sharper:
  an empty ns set is a **legitimate** declaration ("carries nothing"), so a mistyped flag looks exactly like a
  deliberate drain at plan time.
- 18 tests: `packages/agentd/test/capacity.test.ts` (rule 7),
  `apps/agentd/test/node-admission.test.ts` (service surface 4), `apps/agentd/test/machine-schema.test.ts`
  (the two strictness tiers 4), `apps/agentd/test/probe-cli.test.ts` (CLI startup gates 3).
  Counterfactual: commenting out the one `admitApps` line in `plan()` turns **exactly** eight tests asserting
  "refused" red (`capacity` 5, `node-admission` 3) and leaves the three asserting "let through" green — the rule
  really is new, and no old test depends on it.
- **acceptance (a real control surface + a real resident probe)**: `bun run app:host agentd --app-routes --config @seed.json`
  starts the real control surface (node `m1` declares `namespaces: ["ops"]`, binding `ops::board@1.0.0`), and
  `bun run node:probe --namespaces ops` → `applied revision 3: place ops::board@1.0.0`;
  with the same binding, changing only the CLI's `--namespaces` to `workspace-b` → every beat is
  `fault plan: … node m1 does not carry namespace "ops" for board; it carries workspace-b`.
  **Not one word of the binding changed**; only the node's own declaration did — this is the on-site evidence that
  "the gate belongs at the plan".

### 8.4 The deployment unit: from an app to "node × app set"

§9's push goes from "push one app" to "push **one node's desired app set**":

```ts
// the landed shape (packages/agentd/src/types.ts)
NodeAppPlacement { bundleId, version, ns, enabled? }   // what is written down: *where*, not *what*
ResolvedNodeApp  = BundleRef + { ns, enabled? }        // resolved: the artifact's own facts + an address
DesiredNode { node: Machine, revision, kernel?: BundleRef, apps: ResolvedNodeApp[] }
```

**A placement does not restate `abi` / `runtimes`** (this is one design corrected during implementation): a
placement only writes "which version of which artifact lands in which ns"; `abi` / `runtimes` / `kind` all come
from the registry. If a placement could repeat those lines itself, it could **contradict** the artifact it places,
and the artifact's own declaration would no longer be enforceable. `bindNode` is therefore "resolution", not
"recording": the placement's `bundleId@version` is looked up in the registry first, then assembled into a
`ResolvedNodeApp`. One honest cost: the config surface (`effect-config.ts`'s `nodeApp`) therefore **cannot see
`kind`**, so a category error like "put a kernel in an app slot" can only be refused at the control surface (which
is where `kind` is visible).

Receipts still reuse agentd's `revision` + `reportApplied` 409 stale mechanism (`agentd/src/control.ts:24`) —
today's `DesiredAgentConfig{agentId, revision, sets, servers}` is the predecessor of that shape.
The pull-based channel (the probe) solves "a node goes offline and comes back" by construction: **the desired set
is itself the source of recovery**.
(The "is this node here right now" dimension and the resident probe have both landed; see §8.5-1.)

**Landed (2026-09-10, §8.4)** — the deployment unit really did go from "one app" to "node × app set":
- `packages/agentd/src/nodes.ts` — `makeNodeArtifactAdapter()` (`kind: "effect-node"`),
  `NodeDeployment { nodeId, kernel?, apps: NodeAppArtifact[], metadata: { nodeId, revision } }`,
  with plan / apply / validate of the same shape as `bundles.ts`'s adapter; the `metadata` field names match the
  other agentd plans, so **one receipt rule covers everything** and there is no second concurrency rule at the node
  level.
- **the adjudication is still the one copy**: `assessBundleForMachine` is called as is; this file only adds
  "iterate item by item + attach an address to a failure" (`cannot place workspace-b::board@1.0.0 on node-1: …`) —
  when the set has twelve items, "the plan failed" is not an actionable message.
- **identity is the placement, not the artifact**: `nodeAppId = ns::bundleId@version`. The same artifact landing in
  two namespaces is two placements (§8.1); the same address appearing twice is the contradiction (`bindNode` and
  `validateNodeDeployment` each stop it once).
- **the kernel slot and app slots are not interchangeable**: an app in the kernel slot or a kernel in an app slot is refused both at bind time and in the adapter's `validate`.
- **deterministic diff**: a new `packages/agentd/src/stable.ts` (recursively key-sorted `stableString` / `same`).
  The cause was a **real bug**: `JSON.stringify` is sensitive to key order, and `artifactOf` and
  `validateBundleArtifact` build the same object with different key orders, so every plan emitted a phantom
  `update`. Fixed in the shared place, so `bundles.ts` (P6) benefits too — rather than working around it only in
  the new code.
- service surface: `GET /agentd/node?node=`, `GET /agentd/node/plan?node=`, `POST /agentd/node/report`;
  MCP tools `agentd_bind_node` / `agentd_desired_node` / `agentd_plan_node` / `agentd_report_node_applied`;
  config surface `nodeBindings` seed field (placed after `bundles`, so a placement can name the artifact just
  published above).
- **Still not done**: CPU/memory quotas and scheduling (§8.3's `namespaces` and app-count ceiling have landed);
  sending bytes across processes **has landed** (§8.2's end); §8.5-5's "on offline recovery, roll back or roll
  forward" is decided (roll forward, see the resident probe section of §8.5-1); and the resident probe itself has
  also landed. (§6.3-②'s full-rebuild tier has landed; see below.)

### 8.5 Gaps

1. ~~node registration / heartbeat / lease (agentd Machine has a draft, mcp-registry has a reusable shape)~~ ✅
   **landed** (2026-09-10, see below) — the mechanism, the control surface, the transport surface and the
   **resident probe** all exist. See "Resident probe landed" below.
2. ~~node-level desired app set + receipt~~ ✅ **landed** (2026-09-10, see §8.4): `DesiredNode` +
   `makeNodeArtifactAdapter()`, one plan covering the kernel + N apps, receipts going through the same 409 rule.
3. ~~isolation between several apps in a node (ns already exists) and **quotas**~~ — ns is already the placement's
   address (§8.4 uses it), the `namespaces` allowlist and the app-count ceiling **have landed** (2026-09-10, see
   §8.3); CPU/memory quotas and scheduling are still open (§11-Q17).
4. **an incompatible kernel swap = every app in the node is rebuilt together** (§6.3-②), so **the bigger the node,
   the longer that tier's window** — which gives §11-Q2 "kernel artifact granularity" extra weight: one whole-kernel
   swap moves all apps, and splitting it finer shrinks the rebuild surface. A compatible kernel goes through
   §6.3-①'s in-place swap, whose cost is independent of node size. A node-level plan makes this **visible**
   (one plan lists the whole set to be swapped), but the rebuild window itself has not been shrunk.
   **Tier ② itself has landed (2026-09-10)**: the rebuild happens, succeeds, and rolls back on failure, but the
   window's length still grows with node size — §11-Q2 and "suspend only the incompatible apps" (§6.5-6's third
   disposition) are the two ways to shrink it — **the latter has landed (2026-09-10)**: the rebuild surface now
   equals only those apps that **declared and cannot keep up with the new line**; apps that made no declaration no
   longer tag along. But on a node with complete declarations this tier can still equal the whole node, so §11-Q2 is
   not finished.
5. desired-state recovery after a node goes offline or crashes (pull-based + the desired set as the source, but
   "roll back or roll forward" has to be decided) — **decided: roll forward** (2026-09-10, see the answer in the
   "resident probe" section below). The preconditions are all in place too: after §8.5-1 "offline" is a **readable,
   testable** state, no longer guessed from `Machine.status`; when the resident probe comes back it pulls the
   **current** revision. Rollback exists as an **operator action** (change the binding), expressed as a forward
   desired-state change; the node side needs no second mechanism.

**§8.5-1 landed (2026-09-10) — a node being online is observed, not declared**:
- `packages/agentd/src/presence.ts` — `makeNodePresence({ leaseTtlMs, clock })` provides
  `announce` / `heartbeat` / `withdraw` / `presence` / `list`. The lease is **evaluated at read time**: no timer,
  no sweep, and therefore no "the cleanup job did not run, so a dead node is still alive" tier.
- **liveness and identity are two separate tables**: `machines` is what a node **is** (identity, capabilities —
  true whether it runs or not), `presence` is whether it **is here right now**. `GET /agentd` gives
  `machines[].status` (what the node says itself) and `nodeLiveness` (what the server sees) **side by side**, so a
  reader can tell which is which — this is also the pair the HTTP tests assert.
- **a deliberate divergence from mcp-registry**: its `static` lease (registered in code counts as alive) is not
  reused. On the node side there **is no** static tier, because "it is written in the config file" is exactly the
  pretense this item exists to end. The test is "a machine declared in the config is offline before it announces".
- **the clock takes the larger of the two**: `age = max(0, wall-clock delta, monotonic delta)`. An NTP jump
  backwards makes the wall-clock age smaller, so a node that is already dead could extend its life off someone
  else's time correction; taking the maximum makes it **impossible to extend a lease by turning the clock back**
  (a jump forwards expires it early — fail-closed). The default monotonic source `performance.now()` has a lifetime
  exactly equal to this in-memory table. Test: "turning the wall clock back cannot revive a dead lease".
- **expiry ≠ deletion**: a lease expiring only turns the node offline; the machine record, the binding and the
  desired set are unchanged byte for byte (`same(whileUp, desiredNode(...))` is true), and an offline node's
  `desired` is readable and reportable as usual. Because the desired set is itself the source of recovery (§8.4) —
  having a heartbeat failure destroy the very thing it is meant to recover is self-contradictory. `withdraw`
  likewise ends only "is it here", not "this node": a clean shutdown is not a decommissioning.
- **renewing does not move the revision; changing a declaration does**: a receipt is about "what should run", so
  if a heartbeat bumped it, every in-flight receipt of an agent **with no binding** would 409 (with no binding,
  `desired()` uses the global revision). But `capabilities` changing in an announce **is** a desired-state change —
  what it changes is "what can be pushed here". Both are tested.
- **the time is set by the server**: `DeclaredMachine = Omit<Machine, "reportedAt">`, and this field is **not** in
  the probe body; carrying an extra `at` is a 400 rather than being ignored — ignoring it would let the caller
  think it has the last word. `reportedAt` is stamped by the server.
- **the declaration shape has two tiers and the difference is not rhetoric**: on the config surface `capabilities`
  defaults to `[]` (the operator omitting it means "none"), and on the probe surface it is **required** —
  defaulting to `[]` is a **silent wipe**, after which every plan refuses without saying why. So the probe body is
  "either state yourself clearly or be refused", and a malformed body returns **400 naming the missing field** (not
  a 500 taking the blame on the caller's behalf). `namespaces` (§8.3) follows the same rule: empty by default on
  the config surface, required on the announce side.
- **credentials**: `nodeToken` is optional and goes through `authorization: Bearer` (the same convention as
  mcp-registry's announce/heartbeat), not in the request body — a secret that does not enter the body does not
  enter the body logs either. The comparison uses `timingSafeEqual`. Unconfigured means open, and
  `nodeLiveness().tokenRequired` **says so out loud**: a gun that is not loaded should not look loaded.
- service surface: `POST /agentd/node/{announce,heartbeat,withdraw}`, `GET /agentd/node/presence[?node=]`
  (without `node` it gives the whole table), MCP tools `agentd_announce_node` / `agentd_heartbeat_node` /
  `agentd_withdraw_node` / `agentd_node_presence`; `GET /agentd` gains `nodeLiveness`.
- 24 tests: `packages/agentd/test/presence.test.ts` (mechanism 9),
  `apps/agentd/test/node-liveness.test.ts` (transport surface 6), `packages/agentd/test/node-presence.test.ts`
  (control surface 9).
  Four counterfactuals each kill **only** one test: the monotonic clock → "turning the clock back cannot revive";
  `rejectClientTime` → "a node cannot say itself when it was seen"; `parseBody`'s 400 mapping → "a malformed body is
  a 400 that names the field"; taking the token from a header → "with a token, refuse and change no state".
- **one honest cost**: this table **does not go to disk**, so after a control-surface restart all nodes show
  offline until the next announce/heartbeat. This is intentional — a lease table restored from disk is a pile of
  **declarations nobody ever made**; the TTL is 30s, so the cost window is about one heartbeat.
- **still not done**: CPU/memory quotas and scheduling (§11-Q17); the `namespaces` allowlist and the app-count ceiling **have landed**, see §8.3.

**Resident probe landed (2026-09-10) — there really is something on the target machine calling this control surface**:
- `packages/agentd-probe/` — `startProbe({ url, machine, token?, intervalMs?, apply?, fetch?, schedule?, onEvent? })`
  returns `{ nodeId, status(), stop() }`. One beat is: `announce` (`heartbeat` if it already holds a lease) → pull
  `GET /agentd/node/plan` → apply → `POST /agentd/node/report`.
- **outbound only**: it opens no listener and no port, so a machine behind NAT needs no inbound path at all (the
  same rule as "an app does not open its own ports"). It uses native `fetch` rather than an app's egress router —
  the router answers "where can **an app** go", and the probe is not an app on this machine, it is this machine's
  own voice.
- **"pull desired" is pulling the plan**: `plan`'s response already contains the **fully resolved**
  `desired: NodeDeployment` and the adjudication result, so reading `/agentd/node` again would be two reads that
  can disagree. §8.4's "one plan covering the kernel + N apps" is exactly for this.
- **what it does not do is stated clearly in `apply`'s default**: the default `apply` is
  `makeNodeArtifactAdapter().apply` — it validates and returns that deployment, it does not invent anything; it
  does **not** move artifact bytes onto the machine. A real machine passes its own `apply`, and the receipt carries
  what it returned: "what was applied" is the machine's answer, not the probe's assumption. To really take bytes,
  pass `stage` (§8.2's end) and the probe wires it to `stagingApply`: fetch back, validate, write to disk, and the
  receipt carries where each artifact landed.
- **the same revision is not applied twice and not reported twice**: `reported` remembers the revision of the last
  receipt, and an identical one means `in-sync`. Otherwise a receipt arrives every 1.5 seconds, and a receipt is no
  longer a receipt but a heartbeat that happens to carry a deployment.
- **failure classification = seven answers, each with its own disposition** (`packages/agentd-probe/src/errors.ts`):

  | Kind | What it is | What the loop does |
  |---|---|---|
  | `unreachable` | no HTTP response at all | keep trying; the node will expire naturally on the control surface — that is the truth |
  | `refused` | 401 / 400 — what the control surface refuses is **us** | **stop**; the same call would be refused the same way forever, retrying is spinning |
  | `unavailable` | 5xx — it arrived, but it is broken | keep trying |
  | `lapsed` | 404 "node is not present" — the lease expired | **announce again** within the same beat |
  | `stale` | 409 — the desired state moved while we were applying | pull again next beat; this is progress, not failure |
  | `plan` | the planner refused **this deployment** (400) | report it; do not apply, do not claim success, and do not send a receipt |
  | `apply` | the local side threw (including errors that cannot be attributed) | report it, send back a **failure receipt**, keep retrying |

  All seven share one point: **not one of them is success**. The reason this layer exists is that "cannot reach
  the control surface" must not be read as "the deployment was applied". The receipt shape is still the platform's
  one `{ nodeId, revision, state }`, with `state` being the probe's own payload
  (`{ok:true, deployment}` / `{ok:false, error}`), not a second set of receipt rules.
- **`stop()`'s farewell must be delivered to count as clean**: when it cannot reach the control surface `stop()`
  **throws** rather than quietly returning — a `stop` that swallows the failure would report a clean exit for a node
  that is "still listed online until its lease expires", and an exit disagreeing with the record is exactly what
  withdraw exists to prevent. Memoized into a promise: SIGINT and SIGTERM arriving together still withdraw only
  **once**.
- **`leaseTtlMs` went into the config surface** (`apps/agentd/src/effect-config.ts`): a lease TTL is an operator
  policy, not a constant, and **an unsettable TTL is a lease nobody can watch expire** — the acceptance test uses
  it, squeezing the TTL to 300ms to watch it really expire.
- CLI: `bun run node:probe --url <base> --id <m> [--name] --capabilities a,b --namespaces a,b
  [--max-apps n] [--token] [--stage <dir>] [--interval]`,
  human-readable output all goes to stderr (stdout is left for the protocol); SIGINT/SIGTERM go through withdraw,
  a clean exit is 0, a failed farewell is 1. Both `--namespaces` and `--capabilities` are startup gates:
  **missing means it refuses to start**, rather than letting a node come online with an empty declaration and then
  explaining it with a string of refusals (§8.3).
- 22 tests: `packages/agentd-probe/test/` (transport 5, one beat 7, loop policy 4, exit 2) +
  `apps/agentd/test/probe-acceptance.test.ts` (a real socket, 2) + `probe-refusal.test.ts` (the reverse direction,
  2). Nine counterfactuals each kill **only** their own test: `unreachable`→`refused`, `refused` stalling,
  `lapsed` re-announcing, the `in-sync` skip, the failure receipt, the plan 400 classification, the `stale`
  classification, `stop` memoization, `leaseTtlMs` pass-through.
- **acceptance (a real control surface, not a simulation)**: `bun run app:host agentd --app-routes` starts the
  real control surface and `bun run node:probe` starts the real resident probe — after the announce,
  `nodeLiveness` is online → the heartbeat renews (100ms beat / 1200ms lease; past a whole lease it is still
  online and `lastSeen` advances) → a `{ok:true, deployment}` receipt arrives (the placement is
  `ops::board@1.0.0`) and `at` stops changing → the beat is stretched to 60s (**a real stall**, not a test hook)
  and 300ms later the lease expires: `online:false` while `withdrawn:false`, with the machine record, the desired
  set and the receipt **unchanged byte for byte** → after `stop()`, `withdrawn:true` while the machine record and
  the deployment are still there (a clean shutdown is not a decommissioning). Two in the reverse direction: a port
  with genuinely nobody listening → it keeps trying, `beats:0`, and `stop()` throws; a wrong token → 401, it tries
  **only** once and stops, and on the control side that node is `online:false` throughout.
- **§8.5-5's answer (roll back or roll forward): roll forward.** While a node is offline the desired state only
  moves forward (it lives on the control surface, and an offline node's `desired` is readable and reportable as
  usual), and when the node comes back what it pulls is the **current** revision; `reported` is used only for "do
  not repeat the same revision", so there is no path for "come back and reinstall the old version". Rollback has
  not disappeared — it is an **operator action**: change the binding back to the old `bundleId@version`, the
  desired state advances one step, and the node pulls the new revision and applies it as usual. So the two do not
  conflict: **a rollback is expressed as a forward desired-state change**, the node side needs no second
  mechanism, and it will not decide by itself what to install based on "which version was installed last time".
- **still not done**: CPU/memory quotas and scheduling (§11-Q17; `namespaces` and the app-count ceiling have
  landed); sending bytes across processes **has landed** (§8.2's end); the probe reports only "which revision was
  applied", not "this machine crashed and fell back to previous" (P5 has the signals
  `kernelBoot().fellBack` / `condemned`, not yet in the receipt shape); who supervises, starts and restarts the
  probe process itself (today it is one process, and machine-side process management is not here).

## 9. Push and receipt (reusing agentd)

`agentd` already has the skeleton of "hand down + receipt", which is exactly the shape a bundle push needs:

| Existing | Reused as |
|---|---|
| Machine / Agent registration | the target machine and the agent instance |
| `AgentBinding.revision` + `reportApplied`'s **409 stale** | optimistic concurrency for upgrade receipts (`agentd/src/control.ts:24`) |
| `AdapterPlan{agentId, revision, desired, changes}` | showing the diff of an upgrade plan (`agentd/src/types.ts:8`) |
| `GatewayConfigAdapter` generating `{ mcpServers: { effectGateway: { url, headers: { "x-agent-id" } } }, metadata: { agentId, revision, sets } }` | extended into an artifact surface of the same shape: **landed** (P6) as `BundleAgentConfig` (`agentd/src/bundles.ts`) |

**Boundaries** (do not mix them up):
- board manages only tasks; **tool calls** belong to mcp-gateway (see `docs/mcp-gateway-surface.md`);
- **code artifact distribution** belongs to agentd. The three do not cross into each other.

**Node-level extension**: §8.4's `DesiredNode` is a wrapper one layer up on the same mechanism — the push unit
goes from "one app" to "node × desired app set", and the receipt and stale decision do not change.

**Landed (2026-09-10, P6)** — of the three boundaries, agentd's really works now:
- `packages/agentd/src/bundles.ts` — `BundleRef` (`{ bundleId, version, abi, runtimes?, kind?, bootstrapAbi? }`)
  and `makeBundleArtifactAdapter()` (`kind: "effect-bundle"`), with plan/apply/validate of the same shape as the
  gateway adapter.
- **the adjudication is not a second set of rules**: `assessBundleForMachine` routes an app to
  `assessBundleCompat` and a kernel to `assessKernelCompat` (both `effect-bundle` implementations) and does only
  that one fan-out itself. The test asserts directly that "the push side's decision == the load side's decision".
- **machine capabilities** are written in `Machine.capabilities` (`abi:effect-1` / `bootstrap:bootstrap-1` /
  `runtime:os`); absent means falling back to the SDK's own defaults, but **a misspelled `runtime:` errors rather
  than falling back** — a fallback would let an OS artifact be pushed to a browser machine.
- **the artifact lands in the kernel repo**: `kernelRevisionOf(bundle, revision, dir)` makes the pushed artifact
  **directly** a `KernelRevision`, i.e. the input to `supervisor.stage()` / `EffectServer.stageKernel()`. There is
  no translation layer in between, so the push side and the load side cannot each say something different.
  The `revision` is given by the receiver (the number on the receipt ≠ the number in the repo; two machines, two
  repos).
- **coexisting versions are the rollback**: the binding is named `bundleId@version`, so rolling back is binding back to the old version — no second rollback mechanism needed.
- service surface: `GET /agentd/plan?agent=<id>` produces the plan, and on refusal it uses the adapter's own 400
  and message; MCP tools `agentd_publish_bundle` / `agentd_bind_bundles` / `agentd_plan_bundles`.
- config surface: the two seed fields `bundles` + `bundleBindings`, which stop the "mixing the two ABI lines"
  spellings at parse time (a kernel missing `bootstrapAbi`, an app carrying `bootstrapAbi`).
- **still not done**: today the receipt reports only "which revision was applied", not "this kernel crashed on
  this machine and fell back to previous" — P5 already has the signals for the latter
  (`kernelBoot().fellBack` / `condemned`), but they are not in the receipt shape yet.

**Landed (2026-09-10, §8.2 / P6 byte transfer)** — the last blank in the push chain is filled: a node can really **get** the artifact.

- **where the bytes come from**: `publishBundle(bundle, source?)` gained a second parameter — a **directory**,
  the one `compileEffectBundle` writes (`<outDir>/<bundleId>.effect-bundle/`). The config surface just writes
  `source` on the bundle (`seed.ts` strips it out of the `BundleRef` before publishing: it is "the input to the
  publish action", not a field of the artifact).
- **the artifact repo stores a reference, not a copy** (`packages/agentd/src/artifacts.ts`). Copying would invent
  an artifact lifecycle out of thin air — a second place holding the same bytes, and a reclamation question nobody
  asked — to guard against a case where **reporting honestly is enough**: the source is gone. An expired reference
  is a fact; an artifact that quietly became empty is a lie. Symlinks are **refused** rather than followed: the node
  takes these bytes, and following a chain would turn "publish this directory" into "publish everything this path
  can reach".
- **the digest is defined once and shared by both ends** (`artifact-listing.ts`'s `listingDigest`). A digest is a
  **contract**: if the two ends' algorithms differ, every artifact on the fleet is reported as corrupt, and that bug
  looks like a fleet-level failure rather than an encoder disagreement. The list is sorted by path before the digest
  is taken, so the answer does not depend on `readdir` order.
- **the wire format is JSON + base64** (`artifact-wire.ts`). The Bun 1.3.4 runtime **has no** `Bun.Archive`
  (`bun-types` has it, but at runtime it is `undefined`), so tar would mean this repository implementing a tar
  itself; a compiled artifact is on the order of KB, and the honest exchange is a boring format. `fromWire` first
  verifies each file's sha256, then the digest of the whole list, and only then returns the bytes — **a
  half-written artifact is worse than a missing one** (the load side would go and import it).
- **what it proves is integrity, not authenticity**: the bytes are the bytes the list describes. "Should this list
  be trusted" is `nodeToken`'s question (§8.5-1) and is not answered again here. The digest is recorded at publish
  time and the bytes are read at read time, so **a source changed after publishing** shows up as "a list that does
  not add up" and is refused by `fromWire` by name — which is exactly the failure wanted.
- **one version, one content, adjudicated by the repo owner** (`bundle-registry.ts`): publishing a
  `bundleId@version` twice is always 409 (`bundle already published`), **without comparing bytes** — version
  identity belongs to the repo, and a second publish of the same id is a second writer of the same version, while a
  node that already took the first one holds a different copy. The bytes are recorded only **after** the registry
  accepts, so a refused publish does not leave behind a directory an agent cannot bind. `ArtifactStore.publish`
  therefore has **no** duplicate branch: a path that cannot be reached keeps no code.
- **the credential is at the validation surface, not the routing surface**: `artifact(bundleId, token?)` shares
  **one** `authorized(token)` comparison with the other node verbs (`control.ts`), so `nodeLiveness()` reports one
  gate rather than two that might disagree. Reading an artifact **does not move the revision**: a fetch does not
  change "what should run", and if it did it would invalidate every in-flight receipt.
- **machine-side installation** (`packages/agentd-probe/src/stage.ts`): `stagingApply({ root, control })` — it
  fetches and verifies the whole deployment first, and only **then** writes any directory. A half-applied
  deployment runs a mixture of two builds, which is exactly why this link exists; whereas "nothing applied" leaves
  the previous version intact, plus a receipt naming the reason. Each artifact is written as
  `<root>/<id>.effect-bundle/`.
- **writes are "build beside it, then rename"** (`stage-write.ts`): `<dir>.staging/` is built and then renamed
  over, so a reader sees either the old artifact or the new one, never the union of the two. The deletion before
  the rename is not atomic, and that is **the lesser evil** — what that window leaves behind is an absence (a
  clean "not installed"), whereas a merged directory is a build nobody ever built. The wire path is **remote
  input**, so `..` / absolute paths / empty segments are refused segment by segment before writing: otherwise a
  carefully constructed list entry could make the control surface pick which file on the machine gets overwritten.
- **after `fromWire` there is one more check, "is this the answer to what I asked"**: if the id on the response
  does not match the id requested, refuse — otherwise the bytes would be filed under an id whose digest was never
  verified.
- **the probe is wired up**: `ProbeOptions.stage` = the installation root. The default is still
  `declarativeApply` (told only what should run, fetching no bytes). It is wired by the probe itself rather than
  having the caller pass `apply`: the credential needed to fetch bytes is the same one the other node verbs use, and
  a caller outside the probe has no channel to hand it over. Real-machine CLI: `bun run node:probe --stage <dir>`.
- service surface: `GET /agentd/artifact?id=<bundleId@version>`, answering
  `{ ok, artifact: { id, digest, files[] } }`; `status()` gains `artifactIds` (the versions that have bytes —
  not the same thing as "published").
- 28 tests: `packages/agentd/test/artifacts.test.ts` (reference-style artifact repo 6),
  `artifact-wire.test.ts` (byte-for-byte round trip and refusals 6), `artifact-control.test.ts` (publish / read
  back / credential / revision not moving 5), `packages/agentd-probe/test/stage.test.ts` (writing to disk 2) and
  `stage-refusal.test.ts` (verify before write, path escape, id mismatch 3; the fixture is in
  `artifact-fixture.ts`), `apps/agentd/test/artifact-route.test.ts` (service surface 4),
  `apps/agentd/test/probe-staging.test.ts` (a real control surface + a real probe 2).
  Counterfactual: turning off all three gates at once (`fromWire`'s two digest checks, `localOf`'s escape check,
  `artifact()`'s credential check) turns **exactly** seven tests asserting "refused" red (wire 2, stage 2,
  probe-staging 1, artifact-route 1, artifact-control 1) and leaves the other 1064 green — the three gates are each
  new, and no old test depends on them.
- **acceptance**: `apps/agentd/test/probe-staging.test.ts` starts a real control surface (with the bundle carrying
  a `source` directory) + a real probe (`stage` pointing at an empty directory); the probe fetches and writes
  `board@1.0.0.effect-bundle/entry.os.js`, and the receipt carries `staged: [{ id, dir, digest, files }]`;
  the same case **edits the source file in place** after the control surface is up, and the receipt becomes
  `ok:false, error: artifact board@1.0.0 file entry.os.js does not match its digest (…)` while **not a single byte**
  is written under the root directory.
- **acceptance (a real control surface + a real probe, two processes)**:
  `bun run app:host agentd --port 8137 --app-routes --config @seed.json` starts the real control surface (bundle
  `board@1.0.0` with `source`, node `m1` declaring `namespaces: ["ops"]`, binding `ops::board@1.0.0`), and
  `bun run node:probe --url http://127.0.0.1:8137 --id m1 --namespaces ops --token … --stage <empty dir>`
  → `applied revision 3: place ops::board@1.0.0`, and `<empty dir>/board@1.0.0.effect-bundle/` really contains
  `entry.os.js` and `nested/extra.js` (byte-for-byte identical to the source directory).
  Then **editing the source directory in place** (the control surface read the list at startup) and re-running gives,
  on every beat:
  `could not apply revision 3: artifact board@1.0.0 file entry.os.js does not match its digest (820a96… → ad3af2…)`,
  the receipt on the control surface is `{ ok: false, error: … }`, and `<empty dir>` has **not a single file** —
  not even the kernel directory that arrived first and passed verification, because the whole deployment is one
  decision.
- **still not done**: guarding the source directory (who may write to it, when) is not at this layer — it is the
  publisher's hygiene, not the transport layer's problem; the receipt does not carry "this kernel crashed on this
  machine and fell back to previous" (same as above); who supervises, starts and restarts the probe process itself.

## 10. Landing order

| Phase | Content | Acceptance |
|---|---|---|
| ~~**P0**~~ ✅ | `abi` + `runtimes` declaration and gate (two ABI lines + the runtime dimension) | installing a bundle that declares an incompatible abi/runtime → an explicit error; the existing board bundle's behavior is unchanged |
| ~~**P1**~~ ✅ | **inventory** (the precondition for §6.3 / §7.2): each app's ambient dependencies (R5 can already detect these) + state that cannot be rebuilt after a kernel swap + the runtime it needs | a list exists; non-rebuildable items either move into the store or are explicitly marked as known limitations |
| ~~**P2**~~ ✅ | unified enumeration of the operation set (the host privileged surface included) + **host/kernel split**: splitting `bootRuntime` into bootstrap (invariants) and a kernel artifact | the operation-set half **is achieved** (`/-/operations` lists the host + every app, schema included); the other half of the split was completed in P5's second leg — `boot/runtime.ts` now keeps only the invariants, the kernel becomes an artifact contract under `src/kernel/`, and `loadKernel()` can `import()` **another** kernel from an artifact directory (P2-B deferred "artifact form" at the time, precisely for lack of a supervisor and request protection, see §6.1) |
| ~~**P3**~~ ✅ | **multi-target compilation** + the runtime adaptation layer (capability injection) | **landed**: the same app artifact emits one entry per declared `runtimes`, and an OS host and a browser host given the same set of injected capabilities **behave byte-for-byte identically**; the capability set a sandbox host reports **equals the one actually injected** (an empty sandbox reports empty, not "the process has it so it has it"); a host that cannot supply the capabilities a `requires` declares → refuse before the import and name which is missing. **Not done**: a truly isolated sandbox (today the entry still runs in the host process), a real browser page host |
| ~~**P4**~~ ✅ | **app hot swap**: health check + single-point switch (local) + a per-app previous pointer (the staging slot was not adopted, per §6.4's deviation note; `tools/list_changed` turned out not to be needed, see §6.4's correction note) | a single app changes version successfully and the other apps are uninterrupted; schema breakage is stopped by adjudication or warned; after the hot swap the agent gets the current tool surface; on failure the old version keeps serving |
| ~~**P5**~~ ✅ | **kernel-level double-buffered** swap + active/previous pointers + boot crash rollback. First §6.3-① **compatible in-place hot swap**, then ② the full-rebuild tier | ① **landed and wired into the real process**: the kernel is loaded by `import()` from an artifact directory, and the flip happens after §5's two-line adjudication and the slot-coverage probe, with the old kernel stopping only after its drain finishes; apps are rebuilt zero times (the test asserts `load()` is called only once throughout). ② **landed** (2026-09-10, see below): an incompatible kernel switched to **install after rebuilding the apps** — the `rebuild` capability is injection-based and
  without it the behavior is word-for-word as before (refuse the swap). The kernel artifact's **compiler** has also landed (2026-09-10, see below): the kernel is no longer a "hand-written directory", and `bun run kernel:build` produces an artifact the loader recognizes |
| ~~**P6**~~ ✅ | agentd pushing kernel and app artifacts + receipts (remote, per machine, runtime matching included) | **landed**: the push goes through `makeBundleArtifactAdapter`, machine capabilities are read from `Machine.capabilities`, and a mismatch is refused **at plan time** (reusing `effect-bundle`'s adjudication, not a second set of rules); the pushed artifact becomes a stageable `KernelRevision` directly through `kernelRevisionOf`; the receipt revision matches and a stale one is 409. The cross-process transport layer **has landed** (§8.2's end: artifact repo + `GET /agentd/artifact` + probe staging) |

**P0 / P1 landed (2026-09-10)**:
- `packages/effect-bundle/src/compat.ts` — `EffectRuntimeKind`, `KERNEL_ABI`, `assessBundleCompat` /
  `assertBundleCompat` / `describeCompat`, `BundleIncompatibleError`. Pure functions, computable **before** the
  load (§6.2's stage needs them).
- `loadEffectBundle` gates **before** `import(entry)`: an incompatible artifact executes not a single line (the test proves the registry stays empty).
- `manifest.runtimes` defaults to `["os"]` — a conservative default, so the existing board bundle's behavior does not change; board already declares `["os"]` explicitly.
- `bun run inventory` generates `docs/app-portability-inventory.md`; `bun run check:inventory` is the gate.
- in passing, `scripts/check-boundary.ts`'s scanning primitives were extracted into
  `scripts/lib/system-io-scan.ts`, shared by both scripts (after the extraction the boundary check's output is
  unchanged: 48 packages · 0 error · 0 warning), and a potential escapee was fixed — `.test.tsx` was not excluded
  before. (After P4 added `packages/effect-compat` it is 49 packages · 0 error · 0 warning.)

**P4 landed (2026-09-10)**:
- `packages/effect-apps/src/registration/generations.ts` — `makeAppSlot` / `readAppSurface` /
  `assessSurfaceChange`. The flow is `install → read back the tool surface → adjudicate → probe → commit (retire
  the old generation)`, and any step's failure `restore`s the previous generation; `rollback()` is `install()` run
  backwards (§5).
- `packages/effect-mcp/src/node-server/tools.ts` — `registerTools` registers once, consistent with the registry;
  when two tools sanitize to the same name it **throws and names them**, rather than silently overwriting.
  (The former `ToolSurface.refresh()` reconciliation mechanism has been deleted: the HTTP face rebuilds the server
  per request, so a hot swap is reflected by construction — see §6.4's correction note.)
- `packages/effect-compat` — §5's adjudication model extracted from `packages/script` into a **zero-dependency**
  package (`assessChange` / `assessUpgrade` / `assessRollback`), with `script` re-exporting, so that the app layer
  does not have to depend on the `isolated-vm` native module just to adjudicate.
- deviation: no "staging slot" at the app level; the reason and the cost (a swap window exists) are in §6.4.

**P2 partly landed (2026-09-10) — only the "operation set" landed; the kernel artifact was deferred**:
- `packages/effect-host/src/operations.ts` + `packages/effect-apps/src/operations.ts`: the four operations of
  `/-/planes` went from a regex to declarations (`HOST_OPERATIONS`, with input/output schema), then merged with
  each app's interface tools into one `NodeOperation` table (`makeNodeOperationTable`).
- `GET /-/operations` serves it (a JSON-safe projection, without `invoke`).
- `packages/effect-bundle/src/kernel.ts`: `BOOTSTRAP_ABI`, `KernelDeclaration`, `assessKernelCompat`,
  `assessKernelAgainst` (the matrix that checks every loaded app before a kernel swap). `bootRuntime` gates before
  creating state.
- **not done**: loading the kernel in **artifact form**, and keeping kernel logic out of bootstrap. Reason: without
  a supervisor there is no safe flip point, and doing it alone would only create the window §6.3-① forbids. The
  whole block was handed to P5.

**P5's first leg landed (2026-09-10)**:
- `packages/effect-bundle/src/repo.ts` — `kernel-state.json` (active / previous / condemned), atomic write.
- `packages/effect-bundle/src/supervisor.ts` — `makeKernelSupervisor`: `stage` runs
  `§5 matrix → load → probe → flip → persist → stop the old one`, and a failed flip flips back; `boot(shipped?)`
  falls back to previous and warns.
- acceptance rests on 12 tests, asserting the invariants (the old kernel never stops before commit; a rejected
  candidate executes not one line), not "the happy path runs".
- **not done**: wiring it into `bootRuntime` (needs a facade + request protection), and compiling the kernel into an artifact. That is P5's second leg.

**P5's second leg landed (2026-09-10) — kernel artifact-ization + a stable facade + request protection**:
- `packages/effect-host/src/dispatch-point.ts` — §6.5-5's request protection: `activate` is one pointer
  assignment, `run` grabs the current target **on entry** and counts it, and `retire` waits for it to reach zero
  **and refuses to retire the target currently in service** ("flip first, then stop" went from a comment to a
  constraint that throws).
- `apps/effect-server/src/kernel/` — the kernel becomes a constructible, wholly stoppable unit:
  `types.ts` declares `KERNEL_PLANES` (the slot id + priority belonging to **the host's data**),
  `index.ts` is the **artifact contract** (`createKernel(context)`), `planes.ts` is the implementation shipped
  with this repository, and `load.ts` handles "`import()` an artifact from `revision.dir`" and "one stable stand-in
  per slot".
- wiring (`boot/runtime.ts`): `load(revision)` → the artifact or this repository's kernel; `activate` →
  `point.activate`; `probe` → **a host-side check that the candidate fills every slot** + the kernel's own
  `health()`; `dispose` → `retire` first, then `dispose`. `supervisor.boot()` runs only **after all apps are
  registered** (the kernel's planes are loaded against known apps).
- crash rollback became product behavior: `main.ts` passes `kernelStateFile: .effect-bundles/kernel-state.json`;
  tests and embedded hosts do not pass it and get an in-memory index (no boot should depend on a writable cwd).
- the kernel can now be pushed from outside: `EffectServer.stageKernel(revision)` is P6's entry point, and `kernelBoot()` reports the fallback result.
- acceptance (`apps/effect-server/test/kernel-swap.test.ts`, really starting the service, really writing an
  artifact directory, really `import()`ing): the kernel is loaded from a temp directory and takes over; **when the
  kernel is swapped the app's `load()` is called only once throughout** (zero rebuild); with the flip committed
  and new requests answered by the new kernel, the old kernel is still answering the one in-flight request it
  holds, and only then is it `dispose`d (the test asserts `dispose:hold` appears after the release); an artifact
  left over a slot is refused and the old kernel does not move; a bad revision is recorded as `condemned` and
  falls back on the next boot.
- ~~**still not done**: a kernel artifact still has to be a **hand-written directory** — what P3 landed was
  multi-target compilation of **apps** (`compileEffectBundle`), and **the kernel artifact compiler was not part of
  it**; the push side is P6.~~ → **filled in (2026-09-10)**, see the "kernel artifact compiler" section below.
- **tier ② was filled in (2026-09-10, a later pass)**: an incompatible kernel is no longer just refused; it is
  changed to "rebuild the apps, then install". See "tier ② landed" in §6.3 — the supervisor gained the injected
  `rebuild` capability, and on the product side `replay` is running `bootManifests` again.

**P5's second leg also corrected one item of §6.1 in passing**: see "a correction the implementation forced" at the end of §6.1.

**§6.3-② landed (2026-09-10) — the last unmade half of the K2 decision**:
- `packages/effect-bundle/src/supervisor.ts`: a new injected capability `AppRebuild { teardown, replay }` and
  `stage()`'s ② branch. **Injected means rebuild; not injected means word-for-word as before** (refuse the swap) —
  a capability, not a default.
- **only the effect line's refusal goes to a rebuild**: a bootstrap-line mismatch is still always refused,
  because rebuilding apps cannot save a kernel that cannot run on this machine. A test pins this specifically
  (still refused after injecting `rebuild`, and `teardown` is not called once).
- **the failure paths are load-bearing**: `adopt` / `activate` / `replay` each returning to A on failure and
  replaying the apps; if the replay fails too, it **says plainly that the node needs a restart** (the
  `rebuild-failed` event carries `restored: boolean`) rather than reporting a rollback that looks successful.
  §6.2's invariant still holds in ② (A is never disposed before commit).
- product side (`apps/effect-server/src/boot/runtime.ts`): `replay` is running `bootManifests` again, sharing the
  same registration path as boot.
- acceptance: `packages/effect-bundle/test/supervisor.test.ts` gains 7 (① unaffected, ②'s full order, the
  bootstrap line still refused, the three failure paths, returning on a teardown failure);
  `apps/effect-server/test/kernel-swap.test.ts` gains 2 product-level tests (really starting the service, really
  importing the artifact, really sending a request), asserting the app layer goes offline **before** the flip and
  comes back into service after it succeeds.
- **load-bearing verified**: turning `stage()`'s ② branch back into a refusal → 5 new unit tests go red
  immediately; removing the product side's `rebuild` injection → 2 product tests go red immediately.
- **not done**: the window itself was not shortened (§11-Q2) — §6.5-6's third disposition landed in the next section, shrinking the rebuild surface but not the window's length.

**§6.5-6's third disposition landed (2026-09-10) — suspend only the incompatible apps; the ones that can live do not tag along**:
- `packages/effect-bundle/src/supervisor.ts`: `AppRebuild` became **subset-addressed** with required parameters —
  `teardown(apps)` / `replay(apps)` receive the names the matrix named; `SupervisorOptions.apps()` reports the
  **loaded** declarations. `KernelAppIncompatibility.app` changed from `BundleDeclaration.bundleId` (with version,
  e.g. `io.effect-agent.board@1.0.0`) to **the app-layer name** (`effect.bundle.json`'s `appId`, i.e. `effect.yaml`'s
  `id`) — suspending is done by app-layer name, and mixing the two names would suspend the wrong app.
- `apps/effect-server/src/boot/app-layer.ts` (new): suspending **keeps the slot and hands over only the disposer**,
  so returning puts it back in place and `stop()` still tears down in reverse **load** order (not the append order
  of the last rebuild); returning goes through the **same** `bootManifests` as boot (narrowed by `only`), not a
  separate, thinner registration path; and if returning did not put some app back it throws, so one rebuild cannot
  report a "success" that does not hold.
- `apps/effect-server/src/load-manifest.ts`: `declarationOf(dir, appId)` refuses when the artifact's `appId` and
  the manifest's `id` disagree (`ships a bundle calling itself X, but its manifest calls it Y`).
- **what is really saved today are the apps that "made no declaration"**: the matrix names only apps carrying an
  `effect.bundle.json`; the rest would have been torn down along with them under ② — that is exactly the
  collateral damage this unit removes. Exact ABI matching + "refuse boot when there is a loaded bad app" means the
  "declared but cannot keep up" subset is unreachable today, so the end-to-end proof uses this real axis.
- acceptance: `apps/effect-server/test/kernel-suspend.test.ts` (really starting the service, really swapping the
  kernel: on both the succeeding and the failing line change, a declared app does `load→stop→load`, an undeclared
  app gets only one `load`, and it is in service throughout);
  `apps/effect-server/test/app-layer.test.ts` 5 (suspending keeps the slot, an unknown name is ignored, returning
  restores the position, returning with a lost app speaks up, and returning to a slot that never existed speaks up
  too); `packages/effect-bundle/test/supervisor.test.ts` and `kernel.test.ts` renamed to subset assertions.
- **load-bearing verified** (each round turns exactly its own few red): A suspending ignores the subset + returns
  everything → 4 red; B returning appends instead of placing → 1 red; C removing the "returning lost an app" check
  → 2 red; D removing `declarationOf`'s `appId` check → exactly 1 red (the name-mismatch test).

**The kernel artifact compiler landed (2026-09-10) — filling the one link missing from the P3 → P5 → P6 chain**:
- every other link in this chain was already there: P3 can compile an **app** into an artifact
  (`compileEffectBundle`), P5-2 can `import()` a kernel artifact from `revision.dir` (`kernel/load.ts`), and P6
  can push bytes to a node. **The one thing missing was something that can "produce" a kernel artifact** —
  staging a kernel meant hand-writing a `kernel.js` exporting `createKernel`, so "pushing a kernel" was not
  executable in production.
- `packages/effect-bundle/src/kernel-manifest.ts`: `KERNEL_ENTRY` (`kernel.js`), `KERNEL_MANIFEST`
  (`kernel.bundle.json`), `KernelBundleManifest`, `readKernelManifest`. A kernel does **not** carry an
  `effect.bundle.json` — that shape describes `appId` / `namespace` / `transport`, none of which a kernel has; what
  a kernel has is the two ABI lines. Missing one of the two lines is not "a kernel with a default" but **an
  artifact nobody can adjudicate**, so it is refused **when the manifest is read**, not after the swap is halfway
  done on the target machine.
- `packages/effect-bundle/src/compile-kernel.ts`: `compileKernelRevision({ kernelDir, outDir })` — one
  `bun build` (`--target bun`), producing `<bundleId>.effect-bundle/kernel.js` plus a `kernel.bundle.json` written
  back with the **compiled** entry. The same shape as the app compiler, with no second artifact format.
- `packages/effect-bundle/src/externals.ts`: both artifact kinds share the same set of externals
  (`@effect-agent/*` / `zod` / `react` / `react-dom`). **This is not for tidiness, it is mandatory**: bundle the ABI
  in and the kernel will register its planes on its own copy of `@effect-agent/effect-host`, and that copy is not
  the host's dispatch point — the kernel would "run" without actually being attached to the host. The cost,
  recorded honestly: an artifact can only be loaded where the host can resolve these packages, that is,
  **installed into the host's module graph**, not thrown into an arbitrary directory.
- this repository's kernel can now really be built: `apps/effect-server/src/kernel/kernel.bundle.json` is its
  declaration, and `bun run kernel:build [outDir]` (`scripts/build-kernel.ts`) produces the artifact directory
  under `.effect-bundles/` — the same root as the runtime's `kernel-state.json`, and what `KernelRevision.dir`
  points at.
- acceptance: `packages/effect-bundle/test/compile-kernel.test.ts` 3 (the output is exactly the directory the
  loader imports; a missing `bootstrapAbi` is refused **at compile time** and not one byte is written; a bad entry
  reports `kernel build failed`); `apps/effect-server/test/kernel-artifact.test.ts` 3 (this repository's kernel
  manifest and `KERNEL` are two statements of **the same kernel**; this repository's kernel really can be compiled
  into a directory the loader recognizes; and **the compiled artifact really serves as a kernel revision** —
  really starting the service, really flipping, with `/-/config` answered by the compiled bytes).
- **load-bearing verified** (each round turns only its own few red): A the output manifest writes back the source
  entry instead of `KERNEL_ENTRY` → 2 red; B swallowing `bun build`'s failure → 1 red; C giving a missing
  `bootstrapAbi` a default → 1 red.
- **out of scope**: §11-Q2's artifact granularity (monolithic vs splittable); multi-target kernels (the kernel only declares `os`); runtime-state handover (§11-Q18).

**P6 landed (2026-09-10) — artifact distribution connected to the load side**:
- `packages/agentd/src/bundles.ts` — `BundleRef` / `MachineCapability` / `assessBundleForMachine` /
  `kernelRevisionOf` / `makeBundleArtifactAdapter`. `publishBundle` + `bindBundles` enter the control surface, and
  bindings are named `bundleId@version`, so **rolling back is binding back to the old version** (the repo already
  holds `board@0.13.0` and `board@1.0.0` side by side).
- the refusal happens **at plan time**: the adapter's `plan()` adjudicates each artifact against
  `Machine.capabilities`, and a failing one is a flat 400 with not a byte sent down. The criteria come from
  `effect-bundle`'s `assessBundleCompat` / `assessKernelCompat`, and the test asserts the push side's and the load
  side's decisions are **equal field by field**.
- the two ABI lines do not mix: `publishBundle`, the adapter's validate, and `effect-config`'s superRefine all
  stop "a kernel missing `bootstrapAbi`" and "an app carrying `bootstrapAbi`".
- the landing path: `kernelRevisionOf(pushed, revision, dir)` → `KernelRevision` → `stageKernel()`.
  The test uses a real supervisor to prove a pushed artifact can be accepted, flipped, and have its predecessor
  recorded as `previous`.
- service surface: `GET /agentd/plan?agent=<id>`; MCP tools `agentd_publish_bundle` / `agentd_bind_bundles` /
  `agentd_plan_bundles`; config seeds `bundles` + `bundleBindings`.
- acceptance (`packages/agentd/test/bundles.test.ts` 14 + `apps/agentd/test/agentd-app.test.ts` 3): pushing a
  kernel + an app → the receipt revision matches; a runtime mismatch, an effect-line mismatch and a bootstrap-line
  mismatch are each refused and each **names names**; a stale receipt is 409; binding to the old version rolls back
  with no new mechanism; when a machine declares no capabilities the SDK defaults are used; a misspelled
  `runtime:` errors; the push side's decision == the load side's decision.
- **still not done**: the receipt does not carry the "crashed and fell back on this machine" signal;
  of these three points, "node-level wrapping" has been filled in by §8.4 below, and "incompatible kernel → rebuild
  the whole node" has been filled in by §6.3-②.

**§8.4 landed (2026-09-10) — the deployment unit went from "one app" to "node × app set"**:
- `packages/agentd/src/nodes.ts` — `makeNodeArtifactAdapter()` (`kind: "effect-node"`) +
  `DesiredNode` / `NodeAppPlacement` / `ResolvedNodeApp` (`types.ts`). plan / apply / validate are the same shape
  as `bundles.ts`'s adapter, and `metadata: { nodeId, revision }` reuses the same field names, so **there is still
  only one 409 rule for receipts**.
- **the adjudication was not copied**: `assessBundleForMachine` is called as is; this file only adds "iterate item by item + attach an address to a failure".
- **a placement is resolved, not recorded**: `bindNode` takes `bundleId@version` to the registry and assembles a
  `ResolvedNodeApp`. This is one correction made during implementation — if a placement restated `abi`/`runtimes`
  it could contradict the artifact it places, and the artifact's own declaration would no longer be enforceable.
- **a real bug fixed along the way**: `JSON.stringify` is key-order sensitive, and `artifactOf` and
  `validateBundleArtifact` built the same object with different key orders, so every plan emitted a phantom
  `update`. `packages/agentd/src/stable.ts` was extracted to sort recursively before comparing, and P6's
  `bundles.ts` benefits too.
- service surface: `GET /agentd/node`, `GET /agentd/node/plan`, `POST /agentd/node/report`; MCP tools
  `agentd_bind_node` / `agentd_desired_node` / `agentd_plan_node` / `agentd_report_node_applied`; config seed
  `nodeBindings`.
- acceptance (`packages/agentd/test/nodes.test.ts` 7 + `apps/agentd/test/node-bindings.test.ts` 4): one plan
  covering the kernel + N apps and one receipt; the same artifact in two namespaces is two placements, the same
  address twice is refused; the refusal message **names which placement landed on which machine**; the kernel slot
  and app slots are not interchangeable; a stale receipt is 409; rollback = change the binding.

**P3 landed (2026-09-10) — capability injection became something executable, not just a clause**:
- `packages/effect-bundle/src/capabilities.ts` — the vocabulary and the decision (`CAPABILITY_NAMES` /
  `capabilitiesOf` / `describeCapabilities` / `requireCapability` / `capabilityGaps`).
- `packages/effect-bundle/src/runtime.ts` — the constructors: `ambientCapabilities(runtime, overrides)` and
  `sandboxCapabilities(injected)`. **Two rather than three**: os and browser differ in "what can be provided", not
  in how the seam is built.
- `load.ts`'s `assertCapabilityCompat` sits right next to `assertBundleCompat` — there is **exactly one** refusal
  gate, at the same place as §5's abi/runtime; `requires` is the app's own declaration, and a requirement the host
  guessed does not count as a requirement.
- `compile.ts` emits one `entry.<runtime>.js` per `runtimes` in the manifest and writes them into the artifact
  alongside `entry`; **an old artifact with no `entries` loads as before** (falling back to `entry`), so this is
  not a breaking change.
- the dependency direction was deliberately set right: the decision belongs to `capabilities.ts` (it must refuse
  before the import) and the constructors to `runtime.ts`, and the loader imports only the former — otherwise the
  loader would have to depend on a runtime implementation just to do its gatekeeping.
- acceptance (`packages/effect-bundle/test/runtime-portability.test.ts`, fixture `fixtures/app-portable`): the
  same artifact's `stamp()` result on an os host and a browser host is **equal field by field** (a deterministic
  clock/crypto is injected, so "behaves identically" is not "both ran"); an empty sandbox's `capabilitiesOf` is
  `[]` rather than "whatever the process has it has"; a host that cannot supply `requires` → reports
  `requires [clock, crypto] but this host is sandbox: [storage]`, **and the error reported is the gate's, not the
  entry's own "no clock was injected"** (commenting the gate out and re-running does turn the test red — this
  assertion is verified load-bearing, not decoration); and the browser/sandbox output has no `node:` residue.
- **not done, and to be stated clearly**: the entry still runs **in the host process** today — "sandbox" is
  **about capability**, not **about isolation**; and the browser tier is only "a host with a browser capability
  set", with **no real page** ever having run it (§7.5-5/6).

**Config-store refusals must be actionable (2026-09-10) — `bun run up` really was blocked by one stale record**:
- symptom: the mantis row in `.effect-agent/config-v2.sqlite` was still in its pre-refactor shape
  (`webPort/host/configFile/approvals`), `validateStored` refused it as agreed (**what is stored is authoritative;
  it is not normalized, not rewritten**), and so the whole startup failed. That is right in itself; what was wrong
  is that **there was no way out after the refusal**: the message only said "operator must rebuild the config
  store", without saying **which file** or **how**, and at the time `ConfigStore`/`ConfigRegistry` had no "drop a
  record" operation at all — the only thing an operator could think of was deleting the database, and the database
  holds the records of 7 other apps (board is an `override`, ui-host is `yaml`), so deleting it would be **really
  losing data**.
- `ConfigStore.remove(appId)` (`sqlite.ts` lands on `DELETE FROM app_config WHERE appId = ?`) —
  **only for the app named**. No `ConfigRegistry.rebuild(appId, layers)`: dropping a record is **not** rebuilding;
  a rebuild has to re-seed from **the current schema + the layers the caller gives**, and the yaml layer
  (effect.yaml's `config:`) **is not in the database**, so seeding here would produce only a config that "validates
  but is not the operator's". So the command **drops, it does not seed**, and seeding is left to the next
  `initialize`.
- the refusal must be distinguishable: `ConfigFailureReason = "rebuild-required"` goes into
  `ConfigOutcome.reason` and passes through the registry's error boundary as is (`storageFailure`). **It must not
  be guessed by string matching** — which failures should carry operator guidance and which should not is said by
  the type, not by the copy.
- the message composed by `apps/effect-server/src/config-runtime/runtime.ts` contains the app / the file / the
  **exact command**: `Invalid config for mantis: … — store: .effect-agent/config-v2.sqlite; rebuild it with: bun run config:rebuild mantis`.
  The store file name is written once, in `config-runtime/config-file.ts` (startup and the command must point at
  the same file).
- `scripts/rebuild-config.ts` (`bun run config:rebuild <appId...>`): drops only the records named, reports
  "record dropped / no record" one by one, **does not seed automatically**, and is not part of the startup path —
  a rebuild is always an explicit operator action.
- acceptance: `packages/effect-config/test/rebuild.test.ts` 5 (a refusal is marked rebuildable **and the record is
  untouched**; a non-rebuild failure does **not** carry the marker; dropping one does not touch the others; the
  next `initialize` re-seeds to revision 1 from the current schema + yaml layer; dropping a nonexistent record is a
  no-op) + `record-rejection.test.ts` adding "the reason crosses the error boundary" (3 paths × 7 kinds of bad row)
  + `apps/effect-server/test/config-rebuild.test.ts` 2 (the message contains the file and the command; **really
  running the CLI once**, asserting the board row is unchanged field by field, that startup then succeeds, and that
  the yaml layer is back in `sources`).
- **four counterproofs** (each kills only its own): ① removing `storageFailure`'s reason → 7 red; ② removing
  `validateStored`'s reason → exactly 2 red; ③ changing `deleteRecord` to delete the whole table → 4 red
  (including the product-side CLI one); ④ letting the CLI seed schema defaults in passing → the CLI one red (the
  yaml layer really does get eaten).
- real-machine verification: running `bun run up` against the repository's real store → a refusal carrying the
  file and the command → following it → **startup succeeds** (mantis and agentd re-seeded to revision 1, board
  still rev 2 as it was).
- **the honestly-recorded cost**: startup **fails on the first stale record it meets**, so when several apps are
  stale at once it has to be one at a time (2 this time) — "list every app that needs rebuilding at once" is the
  step that was not done.

**App independence (2026-09-10) — an app that depends on no other app can be hosted alone, with only the MCP surface open by default**:

- the fact before the change: `requires` was declared in **two places** (the descriptor and the effect.yaml
  manifest) and **not one line of code read it**; the only real dependency edge (gateway → mcp-registry) was
  satisfied by one hard-coded line in `boot/runtime.ts`. So "this app depends on no other app" was a sentence
  nobody verified, and "host one app alone" had no entry point at all — only bespoke stdio `main.ts` files and test
  code.
- the new package `packages/effect-standalone`:
  - `registerStandaloneApp(app, { config })` = `makePluginHost()` (**without** `control: true`)
    + `makeEffectRegistry()` + an in-memory config store + `registerEffectApp`. kernel / listeners /
    config-runtime / console / `/-/planes` are **all unique to the composition root** and are not here — they are
    "absent by construction", not "forgotten to be wired". The shared MCP Registry is **injected
    unconditionally** (the same as the composition root): it is a **host context object, not an app**.
  - `dependencyGaps(app, [app.id])` (`src/dependencies.ts`) = the set difference between the declarations and
    "what this host really hosts"; non-empty → throw `dependencyError` **before opening the port**, with the
    message naming who is missing. The same shape as effect-bundle's `capabilityGaps`
    (clock/storage/crypto/network), only a different axis: app↔app vs runtime capability.
  - `startStandaloneApp` (streamable HTTP) and `startStandaloneStdio` (stdio, no port opened).
    **The default surface is enumerable**: `surface` is part of the return value and is asserted by a test. The
    `routes`/`path` an app declares are still registered on the plugin host, but are unreachable without going
    through this face — "only MCP is open" is **a property of this face**, and `appRoutes: true` is what adds the
    app's own surface; the control surface is never opened.
- the declaration kept in one place only: `requires` was **deleted** from `EffectManifest` and from the 8 apps'
  effect.yaml files and written into the descriptor in `apps/mcp-gateway-app/src/effect-app.ts`. The descriptor is
  the authoring contract the loader really reads; that unread declaration is exactly the "write-only metadata" this
  pass exists to eliminate. The hard-coded line in the composition root is **kept** (with a comment now), because
  making it data would mean importing every descriptor before enable, which would change boot's shape — recorded
  honestly as not done.
- entry point: `bun run app:host <appId> [--port n] [--app-routes] [--stdio] [--config <json|@file>]`
  (`scripts/host-app.ts`; manifest reading is in `scripts/lib/app-manifest.ts`, with `import.meta.dir`'s level
  changed). The app is specified by the **`id`** in `apps/<id>/effect.yaml` (the directory name ≠ the id:
  `mcp-gateway-app` → `mcp-gateway`), and the config layer comes from that file's `config:`; human-readable output
  all goes to stderr (with `--stdio`, stdout is the protocol).
  **`--config` does not invent a second set of layer semantics**: it is effect-config's own `override` layer
  (`default < yaml < override`), **merged key by key on top of yaml, not replacing it**; not passing it is today's
  behavior, byte for byte. The reason it exists is that hosting one app alone is for "run some app and take a look",
  and board's yaml points at the **real** `.effect-agent/board.sqlite` (we stepped on this once, 2026-09-10,
  writing two junk tasks into it). At startup it prints which layer each config key came from to stderr
  (`dataFile from yaml` / `dataFile from override`) — **it reports the layer only, it does not print values**,
  because a config may hold credentials; `@file` is resolved relative to the **current working directory**, and if
  it cannot be read startup is refused.
  **An upfront account of boundaries R4/R5**: the new entry point is `scripts/` (outside the scan scope) and
  `packages/effect-standalone` (R4/R5 only apply to `pkg.kind === "app"`), and **no name was added to
  `ioExemptApps`**; ports are opened by the **host** per the repository's convention, apps do not open ports, and
  the lifecycle is symmetrically unregistered.
- acceptance (really running, a real socket):
  - `apps/board/test/standalone-host.test.ts`: board really starts → a **real MCP client**
    (the SDK's `Client` + `StreamableHTTPClientTransport`) connects to the real port → listTools contains
    board_state → board_create lands in that store (`counts.todo === 1`) → on the same port both `/board` and
    `/-/planes` are 404; after `stop()` **the same port can be bound again** (the port really was released);
    plus one override case: `config` points at the manifest's file and `override` moves it elsewhere → the app
    opens **the one it was moved to**, and the one the manifest points at **never exists**.
  - `apps/mcp-gateway-app/test/standalone-refusal.test.ts`: the repository's one real dependency edge — starting
    gateway alone **fails**, and the message contains both `mcp-gateway` and `mcp-registry`.
  - `packages/effect-standalone/test/`: the surface list, `appRoutes` opening the app surface while still not
    opening the control surface, the refusal coming **before the port opens** (a fake listener asserting bind count
    0), the stdio surface (a real MCP client over an in-memory transport), and the shared registry being injected
    (the fixture's plugin reads `context.mcpRegistry` and reports it back); `override.test.ts`: override beats yaml
    key by key and `sources` records `override`, an empty override does not wipe the lower layer, and with no layer
    the value comes from the schema and `sources` records `default`.
  - `apps/board/test/host-cli.test.ts`: a real process runs `bun scripts/host-app.ts board` (a scratch cwd, a real
    SIGINT, because the data file in the manifest is a **relative path** and the cwd is what decides which file is
    "the real one") — with `--config`, the `.effect-agent/board.sqlite` the manifest points at **is not created**,
    the file the override points at is created, and stderr reports `from override`; without it, the reverse
    (`from yaml` + the manifest file created), the two ends being each other's counterfactual.
    Two more: `@absent.yaml` and `--config '[1,2]'` both exit 1 **before hosting** (the latter using the config
    registry's own "layers must be objects", not a separate rule the host invented).
  - zero regression for the composition root: starting the composition root with the **real root effect.yaml** on
    a temp port + a temp config store → `/-/status` 200, `/-/operations` 200, `/board/` 200, the control surface
    404, and with gateway in the enabled set the registry closure still holds (the plugin did not throw "requires
    the shared MCP registry").
- **five counterproofs** (each kills only its own): ① commenting out the dependency gate → exactly two refusal
  cases red; ② the face ignoring `appRoutes` and letting everything through → the default-surface one red;
  ③ non-MCP paths always 404 → the `appRoutes` one red; ④ not injecting the shared registry → the injection one
  red; ⑤ removing the `closed` flag `stop()` built itself → **all green**, proving that guard is redundant
  (`asyncDisposer` is already memoized, and a second `close()` on the sqlite store returns directly) — so it was
  **deleted** rather than kept as decoration.
- **honestly-recorded costs / not done**: ① there is **no egress router** here, so an app that declares `egress`
  and really sends requests will have `context.fetch` refuse when hosted alone (board sends no requests, so it runs
  alone fine); ② there is no config surface, so "host one app alone and change its config" is not possible today,
  and the config layer can only come from effect.yaml or the caller (`--config` goes through the config registry's
  **override** layer, not the config surface); ③ the composition root's dependency closure is still that one
  hard-coded line; ④ distributing artifacts across processes, and §8.3's CPU/memory quotas and scheduling, are
  still out of this scope (§8.3's `namespaces` and app-count ceiling have landed); the resident probe has landed,
  see §8.5-1.

P0 is purely additive. **P4 (app hot swap) and P5 (kernel hot swap) are two independent goals**, but they share
the same set of primitives — do P4 first and assemble the material P5 needs along the way; no kernel hot swap is
introduced before P5.
P3 and P4/P5 do not depend on each other (one is portability, the other a swap mechanism), but both rest on P1's
inventory conclusions.

## 11. Open questions (need a decision)

1. ~~kernel hot-update granularity~~ → **decided: K2** (§6).
2. **kernel artifact granularity**: one whole kernel as one bundle, or splittable into several (routing / config /
   UI / MCP surface each swappable)? The finer the split, the smaller the swap window, but the harder the
   compatibility matrix and consistency are to maintain.
3. **request semantics inside the swap window**: queue (with what timeout), or fall back to A (which may read half-new, half-old)?
4. **bootstrap's boundary**: are §6.1's four items enough — "the route **table's contents**" is the kernel and "the
   dispatch **point**" is the host; should this line be pushed further down (does the listener belong to the kernel
   too)?
5. **abi mismatch policy**: refuse to load, or run isolated + warn? ("refuse the kernel swap" and "suspend only the
   incompatible app" are two granularities) — the second granularity **is implemented (2026-09-10, §6.5-6's third
   disposition)**; "run isolated at load time" is still open, and today a mismatch is only handled at swap time,
   not at load time.
6. **compatibility decision**: look only at the abi major, or also validate the kernel semver range?
7. **how many rollback points to keep**: only 1 previous, or N (disk vs rollback-ability)?
8. **modelling the host privileged surface**: should a host node also write a descriptor (today these are
   scattered `/-/planes/*` control routes)? *Half answered (P2-A)*: they are no longer scattered —
   `HOST_OPERATIONS` declared the four as data and put them into the node operation table. What is not yet decided
   is **whether to go one step further**: give it a descriptor of the same shape as an app's (carrying the
   lifecycle privileged surface) and let the host also go down the `registerEffectApp` path, rather than a table
   with only four entries.
9. **namespace and version**: when several versions of an app of the same name coexist, should the ns carry the version (affects §4's addressing).
10. **what the sandbox tier is for**: is an app running in a sandbox "the equivalent of a whole app" or "an app with degraded capabilities" (which operations must be absent)?
11. **the browser tier's two-way channel**: what does host→app push go through in a browser (the resident WS left open in `effect-bundle-mesh.md` §5)?
12. **storage backend priority**: do IndexedDB first, or do "sandbox/browser storage proxied back home" first?
13. **the granularity of a runtime mismatch**: refuse to install the whole app, or disable only the operations unavailable in that runtime?
14. **who triggers an app hot swap**: driven only by a host push (§8), or can the app author trigger it too (hot reload during local development)?
15. **the length of the two-versions-coexist window**: is there a cap on the drain (force-cut the old version after a timeout?), and may requests inside the window cross versions.
16. **who decides "a compatible kernel"**: only the `abi`, or also **the structural version of the kernel's own runtime state** (which would mean adding a kernel-state schema version to the manifest)?
17. **node resources**: does a node declare quotas (app-count ceiling, CPU/memory), and should there be
    **scheduling** (deciding which node an app lands on)?
    — **half answered (2026-09-10)**: what was added is the **app-count ceiling** (`Machine.maxApps`, optional; an
    absence reads as "declared no ceiling" rather than 0, and the platform does not invent a number for the node),
    enforced as admission at the node plan (see §8.3).
    **CPU/memory quotas were not added**: they need a node to report available amounts and need a measurement
    convention, and today neither exists, so adding a numeric field nobody fills in would only turn the
    "declaration" into decoration. **Scheduling was likewise not added**: placement is hard-coded by `nodeBindings`
    today and is the operator's choice; introduce it when the question "several nodes, which one should this app
    land on" actually appears, rather than setting up a scheduler first and looking for its use.
18. **how kernel runtime state is handed over** (§6.3-①): is the in-memory state of the plugin registry / route
    table / config runtime serialized and handed to the new kernel, or does the new kernel rebuild it from the
    store itself?

## 12. Relationship to the existing documents

```text
this document (the main line): declaration layer → kernel → operation set → runtime portability → lifecycle (upgrade/rollback)
   ├─ layers.md                      package layering (L0-L5, the algebraic layers)
   ├─ effect-unified-on-mcp.md       app = MCP server, the MCP projection of the four planes
   ├─ effect-planes-permissions.md   plane addressing + permissions (§4's vocabulary, §7's storage proxy)
   ├─ effect-bundle-mesh.md          artifact form, register back, mesh, the browser-host precedent (§6/§7's artifact basis)
   ├─ script-sandbox.md              sandbox execution + content-addressed versions + graded compatibility adjudication + rollback (§5/§7's ready-made precedent)
   ├─ platform-network.md            ports/routes/egress + agentd/mcpset (§8's distribution basis)
   └─ mcp-gateway-surface.md         the unified entry point to the tool surface (on the agent side there is only one /mcp-gateway)
```
