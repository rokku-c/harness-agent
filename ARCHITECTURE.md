# effect-agent Architecture

> One sentence: **an agent is a declarative program with typed input and output, a set of
> connections it may use, and exactly one entry — a capability exposed by a connection, or a
> local LLM behavior.** Everything else in this document is just the consequences.

## 1. Three facts

1. **Everything an agent needs to run is a description.** IR never contains executable
   functions; it is serializable (JSON/YAML/TOML) and pure data. The kernel is browser-safe
   (parsing of YAML/TOML lives in the model layer). State is therefore always *derivable*: a
   running agent is a pure description plus
   explicit runtime state, so full-chain persistence and arbitrary recovery stay possible by
   construction (a goal the architecture serves, not a feature it ships).
2. **Every runtime capability is reached through a Connection.** A connection is a stable
   spec in front of an adapter; capabilities are negotiated by name, and only what a driver
   really declares is ever offered.
3. **Every execution ends in one invoke.** The entry runs `runtime.invoke(connection, capability, { input, agent })`
   and one lifecycle carries result and events back out.

## 2. Layers

| Layer | Where | Owns |
|---|---|---|
| Kernel | `packages/core` | `ConnectionRuntime`, spec/adapter/session, capability negotiation, error aggregation + failover, the canonical `AgentIR` (connection graph), `compile` -> `GraphProgram` (run = one invoke). No LLM knowledge; browser-safe. |
| Model | `src/` | typed `Agent` API (`define/returns/implementedBy`), `Until`/`Capabilities`/`requireUntil` negotiation, `Binding`/`Op`/`AgentContext`, `BehaviorSpec` + `BehaviorRegistry` -> `compileBehavior` -> typed `AgentProgram`. |
| Drivers | `src/vercel.ts`, `src/composed/` | concrete SDK adapters (Vercel, Claude Code, Codex, Pi); each declares **honest** capabilities and fails negotiation early rather than faking. |
| Bridge | `chan/` | direction A sketch: effect-agent as a dsh plugin — the mapping (dsh `ctx.tools` -> Connection capability registry, dsh agent-loop -> Driver runtime) is documented, the bridge itself is not yet implemented. |
| Host adapter | `packages/builtin` | direction B: dsh as a Connection — `dshSdkAdapter` exposes `dsh.agent.run` (committed; docs/dsh-connection.md). |
| Observability shell | `packages/repr`, `ui`, `tui`, `webui` | shared semantic UI state (`repr`), adaptive layout (`ui`, yoga), terminal and web renderers over the same snapshot; `community` is a boundary stub (core never depends on it). |

## 3. Canonical vocabulary (one word per concept)

- `AgentIR` — the one IR: a serializable connection graph (`input`, `output`, `connections`,
  `entry`). Defined once, in the kernel.
- `compile` — the one graph compiler; yields a `GraphProgram` that performs one invoke.
- `BehaviorSpec` — the declarative form of a behavior agent (`id`, `output`, `behavior` ref);
  `compileBehavior` resolves the ref through the `BehaviorRegistry` and yields a typed
  `AgentProgram`.
- `Capabilities` / `Until` — the honest negotiation pair: an agent states what it needs
  (`Until`), a driver states what it really has (`Capabilities`); `requireUntil` fails early
  with `UnsupportedCapability` instead of pretending.
- `ConnectionEvent` — the one event shape leaving the kernel. (Drivers additionally expose their own observation events via `DriverEvent`/report, and host adapters may pass through untyped payloads, e.g. dsh SDK events.)

## 4. Lifecycle (one path)

`spec -> open` (connect; failures aggregate into `ConnectionOpenError` and may fail over) ->
`negotiate` (required ∩ declared) -> `invoke` (`{ input, agent }` envelope) -> `result + events`
-> `close` (client close first, then `PubSub.shutdown`, so subscribed streams terminate).

## 5. Design principles

1. **Declarative core** — IR never contains functions; the kernel knows no LLM.
2. **Honest capabilities** — only what a driver really does is declared; pause and tool-call
   interception are never faked; `UnsupportedCapability` fails early (e.g. codex declares
   `thinking: false` because its SDK is turn-granular).
3. **Injection-first** — no hard SDK dependencies; structural types and lazy loaders (the dsh
   adapter pattern); SDK wiring is an explicit acceptance item, not a silent assumption.
4. **State is a description** — agents are pure data, so persistence/recovery is possible by
   construction (see fact 1): IR is a plain value, runtime state is just `context` plus the run
   position, so persisting = serializing the IR and recovering = recompiling + resuming (codex
   `resume` is already first-class). What is not yet covered (e.g. mid-run event replay across
   processes) is tracked as a gap, not papered over.
5. **One vocabulary** — one `AgentIR`, one graph `compile`, one event shape; naming
   unification was P0 (guarded by grep/typecheck), and the capability-matrix test pins the
   negotiated semantics so they cannot silently drift.

## 6. Real vs aspirational

Working today: all four drivers with the honest negotiation matrix (`test/capability-matrix.test.ts`:
text all OK, thinking all but codex, toolCall REJECT until interception exists, stop/schema OK);
the dsh connection adapter end-to-end (`dsh.agent.run`, events, failover); the declarative
`BehaviorSpec` compile path; the chan bridge sketch; worked examples (`examples/01-07`) and the
observability shell (repr/ui/tui/webui).

Boundary (B2): **typed = imperative** (`Agent.define` hand-written); **declarative =
untyped today**. `compileBehavior`'s `Output` parameter is a half-step: the output
mapping is declared (`OutputOf`: stop/text/thinking -> string, toolCall -> ToolCall
content, schema -> unknown) but must be caller-annotated for schema specs, and the
declarative path has zero examples yet. Full typed lowering (schema -> `Schema.Type`,
input schema -> typed I) is a B2/P2 candidate.

Next: **P1** unified event/pause protocol (streamText + approval boundaries, in-process Claude
SDK MCP, Pi pre-tool hook; enables interception-grade `toolCall` and resume; codex
reasoning-summary extraction). **P2** kernel `open()` single-flight (concurrent first-invoke
race), `BehaviorSpec` lowering into the connection graph. Completeness gaps tracked in
DRAFT.md §26 (Writable, Container filtering, ResourceRef/Resolver, Context DAG/fork,
HarnessPolicy, remote Container).

## 7. Docs map

- README.md — entry point (English)
- ARCHITECTURE.md — this spine (English)
- packages/README.md — package boundaries and inventory (English)
- examples/README.md — worked examples (Chinese; English summary at top)
- DRAFT.md — detailed vision + spec (Chinese; the living whitepaper)
- IMPLEMENTATION.md — implementation notes + adapter state table (Chinese)
- docs/p0.md, docs/dsh-connection.md — design records of completed work (Chinese)
