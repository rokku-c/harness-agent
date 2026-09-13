# effect-agent

> A unified agent programming model on Effect. The system does not treat the
> LLM as a base concept: a model call, a full tool loop, or an external agent
> like Claude Code - all of it is just an Agent.

```text
Agent<Input, Output, Error, Requirements>
    = Input -> Effect<Output, Error, Requirements>
```

Start the platform with `bun run up`, then point an MCP client at
`http://127.0.0.1:8080/effect-apps`. Development work can be exercised through
`bun run codex:session`, which records a Board task and leaves it in `doing`;
set `CODEX_COMPLETE=1` after implementation to close it. Use the same MCP
surface for `agentd` identity/config state, Gateway policy calls, and
observe/monitor data, so implementation and verification share one runtime.

Boot is honest about failure and never fatal for one app: a bundle that cannot
load is reported by name, left disabled, and the home comes up without it — you
need the console and the other apps most exactly when one of them will not
start. An app whose stored data is from an older schema says what it found and,
by default, moves that file aside (`.incompatible-<stamp>`) and starts fresh
rather than migrating it; a stale config record refuses with
`<subject> does not match the current schema; operator must rebuild the config
store`, which `bun run config:rebuild` performs. Nothing is deleted and nothing
is rewritten on the operator's behalf.

## Current platform boundary

- Built-in apps are port-free handlers. The app SDK registers routes and instance
  tools; platform listeners expose the same service table unless explicitly filtered.
- `@effect-agent/effect-network` owns managed listeners and application egress
  (`main-first` default, `local-first`, `local-only`, `main-only`). Upstream selection
  is separate from exit-node selection.
- AI Gateway supports multiple named upstreams, including several of the same API type.
- Board is a task board, not an agent scheduler or a Claude configuration installer.
  Machine/agent MCP configuration belongs to the agentd + MCP Gateway/mcpset center,
  which is implemented (`packages/agentd`, `packages/mcp-gateway`, `apps/agentd`,
  `apps/mcp-gateway-app`).
- No backward compatibility or automatic data migration. See `AGENTS.md`.

Current contracts: `docs/platform-network.md` and `docs/config-providers.md`.

## The shape of the repository

41 packages and 11 apps. Apps are not imported by name — the host discovers each
one from its `effect.yaml` and loads the `module` that file names, so an app is a
plugin that declares its own routes and tools. `apps/effect-server` is the
composition root that boots them; `docs/app-portability-inventory.md` is the
generated app listing.

### 1. The agent algebra (layered by change axis)

The core stays minimal and stable; everything else is a replaceable seam
(Tag + Layer, agenthost-style). Swap implementations by providing Layers;
`assembly` is the composition root that turns all seams into one runnable
instance. See [docs/layers.md](docs/layers.md) for the map.

| layer | package | role |
|---|---|---|
| L3 core | `core` | the symbolic abstractions: Content / Until / Op / Binding / Driver / Agent - pure vocabulary, zero I/O |
| L3 core | `builtin` | the built-in drivers: **EffectAgent** (the default Effect-TS loop) + **ClaudeCode** (the ComposedAgent adapter) + the provider catalog |
| L1 base | `model` | the Model contract (wire types + capabilities), openai/anthropic providers, config-driven model catalog |
| L1 base | `channel` | Ingress / Delivery adapters (inbound + outbound); MemoryChannel is the open-box default |
| L1 base | `tools` | the API-as-data tool registry (ToolDescriptor -> any surface) + MCP session adapter |
| L2 state | `state` | Store, EventLog (append-only, model-visible = logged), checkpoint persistence |
| L2 state | `storage-typeorm` | the SQLite implementation of `state`'s Store + EventLog |
| L2 state | `memory` | remember / recall / promote: long-term memory with a pluggable learning gate |
| L4 orchestration | `gate` | pre-execution approval: AllowAll / DenyWrites / Manual (operator-confirmed) |
| L4 orchestration | `schedule` | Interval / At triggers; process-local default, external cron can implement the same service |
| cross-cutting | `logger` | log levels, sinks (console / json-file / composite / noop) |
| cross-cutting | `assembly` | the composition root: `defaultLayers()`, `driver()`, profile-driven assembly |

### 2. The effect-app platform

A plugin/kernel host in which an app declares tools, config, UI and lifecycle as
data, and is hot-loaded, versioned and compatibility-gated.

| package | role |
|---|---|
| `effect-interface` | registration of schema-exportable interfaces and tools; `registerInterface` returns a disposer, so registering and revoking are symmetric |
| `effect-host` | dependency-inverted plugin host: lifecycle ownership, request routing, `/-/planes` privileged operations as data |
| `effect-config` | where apps declare config: reversible registry, `default < yaml < override` merge with per-key provenance, SQLite store |
| `effect-apps` | app catalog (`ns::appId`) with a per-entry `authorize(op)` gate over the ui/state/config/store planes, plus one MCP server to browse and operate every app |
| `effect-bundle` | kernel/app artifacts + the compatibility matrix + the double-buffer supervisor (stage B, health check, flip; A is never stopped first) |
| `effect-compat` | the one graded compatibility adjudication (schema/deps/description/behavior x strict/warn/ignore), used by scripts, kernels and app generations |
| `effect-network` | `makeEgressRouter` (what an app may reach) and `makeListenerManager` (host/port listeners) |
| `effect-standalone` | boot **one** app alone: registration + its own listener + `/mcp` face + stdio face |
| `effect-observe` | sample the world from app/agent/global perspectives, detect when what an agent would observe changes, keep timestamped frames in SQLite |
| `effect-parity` | machine-parity view of an app: the human gets exactly the agent's document, state and actions |

### 3. Declarative UI

Declare a UI once as data, resolve it against state, render it through a
swappable renderer.

| package | role |
|---|---|
| `effect-ui` | the declaration layer: a view names `@radix-ui/themes` components and exports as JSON Schema; renderers are swappable behind one seam |
| `ui-protocol` | pure UI data types (`UINode`, `CanvasDefinition`, `UIEvent`, `BindingExpression`, `UICommand`); zero dependencies |
| `ui-definition` | `DefinitionStore`: applies commands to a canvas tree with tree/version/capability validation |
| `ui-extension` | `ExtensionRegistry`: enable/disable extensions that register and unregister component definitions, with rollback |
| `ui-runtime` | resolves bindings against state into a `ResolvedUITree`; actions, journal/restore, data sources |
| `ui-renderer` | `RendererRegistry` + themes + the React/`@json-render` renderer |
| `ui-agent` | exposes canvas operations (create/insert/patch/bind/enter/link) as agent Ops |
| `ui-sandbox` | permission-gated wrapper around `script`'s runtimes for untrusted extension code |

### 4. Machine center

The multi-machine control plane: a central daemon plus an outbound client on each
managed machine.

| package | role |
|---|---|
| `agentd` | server side: control, facts registry, launch queue, tunnel, node presence and leases, bundle/node artifact adapters |
| `agentd-probe` | the outbound half: a resident program behind NAT that calls out and never listens |
| `agentdeck` | middle-abstraction control plane over foreign agents: normalized flow control, consent ledger, unified config map, plus adapters (effect, demo, effect-ops, claude-sdk, CLI) |

### 5. MCP surface and authorization

| package | role |
|---|---|
| `effect-mcp` | builds a node MCP server over one registry: the app's tools plus, optionally, its UI and store planes |
| `effect-mcp-http` | serves an MCP server over streamable HTTP (WebStandard transport, optional authenticate) |
| `mcp-gateway` | the gateway pipeline: resolve -> authorize -> proxy -> audit; sets, bindings, rules, principal identity, tokens, redaction |
| `mcp-registry` | in-memory MCP catalog with authenticated control-plane ops, leases/heartbeats and selection preference |
| `effect-authz` | pure in-memory authorization engine: principals, actions, resources, policy templates, grants, decision, audit |

### 6. Capabilities outside the layer stacks

| package | role |
|---|---|
| `script` | capability script sandbox: scripts compose toolcalls into higher tools; closure visibility + content-addressed versions + graded compatibility (see [docs/script-sandbox.md](docs/script-sandbox.md)) |
| `ai-gateway` | provider-agnostic LLM proxy core with zero dependencies: request/response event contract, prompt injection, redaction, rule matching |

### Apps

`effect-server` (the host and composition root) hosts `agentd`, `ai-gateway`,
`board`, `deckconsole`, `herdr-app`, `mantis`, `mcp-gateway-app`,
`mcp-registry-app` and `ui-host` on one shared listener, at `127.0.0.1:8080` by
default. `playground` is an example script rather than a server. Each app can
also be booted alone through `effect-standalone`, on its own port.

## The loop as a sentence

An agent definition expresses WHAT it does; the driver decides HOW the loop
runs. The same definition runs on a scripted test driver, the default model
loop, or Claude Code - unchanged.

```ts
const Planner = Agent
  .define("planner", (task: string) => AgentContext.text("Plan: " + task))
  .returns(Until.schema(Plan, { name: "return_plan", description: "Return the plan" }))     // the loop's termination = the output type
  .uses(notes)                     // capability access: read
  .writes(issueTracker)            // capability access: write
  .implementedBy(EffectAgent.make({ model }))   // swap the driver freely
```

- **Until<A>** - termination as data, and the agent's output type:
  `Until.text`, `Until.toolCall` (intercepted pre-execution),
  `Until.schema(Plan)` (structured output), `Until.thinking`, `Until.stop`.
- **Op<I, O>** - Schema-typed operations with `Op.read`/`Op.write` access
  modes; descriptions are notation (the prose rule: every model-facing text
  resolves from a store).
- **Binding** - a named capability resource (`ea://registry/kind/id`): read
  content materializes into the context before the run; ops become the
  driver's tool surface.
- **Driver** - the loop engine. `RunRequest` (context + until + access) in,
  output out. Drivers declare **Capabilities**; `requireUntil` fails loud
  with a precise reason when a driver cannot honor the requested boundary.
- **Harness** - the observable loop: hooks see RunStarted / ToolStarted /
  ToolCompleted / Output / RunCompleted for any driver.

## The two drivers in builtin

**EffectAgent** - the default self-driven loop, implemented in pure
Effect-TS: context -> model -> tool call -> binding op -> tool result ->
context -> until. Zero SDK dependencies; models come from the provider
catalog (`config.toml` + `.env`, `anthropic.messages` / `openai.chat`).

**ClaudeCode** - Claude Code as a ComposedAgent: a black box with its own
loop, tools and runtime. Binding ops become native MCP tools inside its
process; the Until condition decides what comes back.

## Orchestration: sessions, signals, and the runtime

Supervision is not a framework feature - it is the same algebra, applied
recursively. The runtime provides three primitives, all URI-addressable or
data-shaped:

- **AgentSession** - an optional Effect service the runtime gives each run:
  a signal box (in) and an event bus (out). The EffectAgent loop drains the
  signal box at every step boundary: `Inject` appends to the context and
  thread, `Interrupt` ends the run cooperatively. Anyone holding a child's
  session can inject or interrupt it mid-run.
- **Watch rules** - declarative timing: `{ when: { kind: "progress" },
  spawn: { agent, task } }` forks a responder the moment a child emits the
  declared event. Task templates interpolate `{child}`, `{agent}`,
  `{text}`.
- **Boards & groups** - pure `Ref`-backed structures behind
  `ea://board/<name>` and `ea://group/<name>`: shared whiteboards children
  post to, and fan-out channels whose posts land in every member's signal
  box.

The **runtime ops** are a binding (`ea://runtime/agents`): spawn_agent /
send_child / interrupt_child / wait_children / report_progress /
create_board / post_board / read_board / create_group / post_group /
read_group. A supervisor is just an agent that `.writes(runtimeBinding)`;
its model sees the registry roster (materialized from the binding's read)
and drives coordination as ordinary tool calls. Children receive the same
runtime and registry, so orchestration recurses.

```ts
const Supervisor = Agent
  .define("supervisor", (goal: string) => AgentContext.text("Goal: " + goal))
  .returns(Until.text)
  .writes(runtimeBinding)                    // coordination ops as tools
  .implementedBy(EffectAgent.make({ model }))

// provide FiberAgentRuntime.layer(registry) - children run as scoped fibers
```

Structured concurrency holds throughout: children are `forkScoped` into the
supervisor's scope, so they die with it; `wait("all" | "first")`
joins them as `ChildResult` data (completed / failed / interrupted).

## Batches: map / filter / reduce over children

Large-scale parallel manipulation takes its shape from collection algebra,
composed from the kernel - no new machinery:

- **map** - `map_children { agent, tasks, concurrency, join }` fans out one
  child per task with bounded concurrency and (by default) returns every
  result: a parallel map in one tool call.
- **filter** - `children_where { agent?, status? }` selects children;
  act on the matches with `send_child` / `interrupt_child`.
- **reduce** - deliberately not an op: a **board is the accumulator**
  (`post_board` folds, `read_board` finalizes - append is a monoid), and
  small result sets reduce in the supervisor's context straight from
  `map_children`'s return. Combine with watch rules for reactive batches:
  a responder forks the moment a child reports.

```ts
// one call: three scans, two running at a time, results folded back
{ tool: "map_children", input: { agent: "scanner",
  tasks: ["alpha", "beta", "gamma"], concurrency: 2 } }
```

## Checkpoints: storable by default, pause and resume anywhere

Every run that declares state is storable **by default**: whenever a
checkpoint store is present, the loop snapshots its logical state (context,
thread, step) at every step boundary under the run's id. A `Pause` signal
archives the state and ends the run as `paused`; `resume` spawns the same
agent hydrated from the archive - the thread continues exactly where it
stopped.

Recovery is policy-driven by **sensitivity declarations**: a run declares
what it is sensitive to, the checkpoint records the declarations, and at
resume the matching notes are injected into the fresh context -

- `TimeSensitive` -> wall-clock drift since the checkpoint ("X ms have
  passed; re-check anything time-dependent"),
- `ExternalEffects` -> "the world may have changed; verify assumptions and
  avoid repeating side effects",
- `Custom { label }` -> "re-validate the assumptions recorded before the
  checkpoint".

```ts
EffectAgent.make({ model, sensitivities: [{ _tag: "TimeSensitive" }] })

rt.pause(childId)                    // archive at the next step boundary
rt.resume(paused.checkpointRef!)     // hydrate + inject recovery notes
```

## agentdeck and deckconsole

The middle-abstraction control layer over mainstream agents
(claude-code / codex / gemini / pi / this framework / any `*claw`-like CLI):

- **Component** `packages/agentdeck` - three surfaces plus five adapters.
  1. Flow control: `SessionGateway` (open/close/send/status/sessions/history)
     with `AgentDeck` registration aggregation.
  2. Session consent mapping: `ConsentLedger` (ask/allow/deny, recorded by
     time), so approval is per session rather than global.
  3. Config normalization: `normalizeConfig(kind, raw)` unifies dialect fields
     and keeps `extra` lossless.
  Adapters: effect (in-process EffectAgent), claude-cc (in-process SDK), and a
  generic CLI adapter whose runtime dialects can be registered at run time, so
  a new `*claw`-like agent needs no code change. Tests run without a model and
  without a real CLI.
- **Product** `apps/deckconsole` - the control room above the component (HTTP
  API + console page): cross-agent session management, approvals (with
  session-level auto/deny policy), config-normalization preview, session
  detail, launch groups persisted to `DECK_FILE`, and one-button close-all.
  It runs standalone with
  `DECK_PORT=4851 bun apps/deckconsole/src/main.ts`, and also ships as a
  platform effect-app at `/deck`.

See [docs/agentdeck.md](docs/agentdeck.md) and
[docs/agentdeck-map.md](docs/agentdeck-map.md).

## Verify

```bash
bun install
bun run typecheck          # tsc --noEmit
bun test                   # 1061 tests
bun run examples           # offline examples (01, 02, 05, 07, 10)
bun run examples 03 --live # live provider roundtrip (config.toml + .env)
bun run examples 06 --live # live supervisor spawning real subagents
bun run check:proofs       # build the Lean model in formal/ (needs a Lean toolchain)
```

`formal/` proves the invariants whose failure is silent — a config provenance
that names the wrong layer, a navigation chain that loops, a stale disposer that
revokes its replacement. [formal/README.md](formal/README.md) lists what is
modelled, and what the model does not claim.

The guards, each of which also runs on its own:

```bash
bun run lint:lines        # every implementation file <= 100 lines
bun run check:boundary    # imports respect the package boundaries
bun run check:ui          # the UI boundary
bun run check:inventory   # every app declares a runtime
bun run check:proofs      # the Lean model in formal/ builds
```

`scripts/verify.sh` is narrower: a one-shot check of `agentdeck` and
`deckconsole` only (their tests, a no-key acceptance run, and a scoped `tsc`).
