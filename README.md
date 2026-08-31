# effect-agent

> A unified agent programming model on Effect. The system does not treat the
> LLM as a base concept: a model call, a full tool loop, or an external agent
> like Claude Code - all of it is just an Agent.

```text
Agent<Input, Output, Error, Requirements>
    = Input -> Effect<Output, Error, Requirements>
```

## Packages

| package | role |
|---|---|
| `@effect-agent/core` | the symbolic abstractions: Content / Until / Op / Binding / Driver / Agent - pure vocabulary, zero I/O |
| `@effect-agent/builtin` | the built-in drivers: **EffectAgent** (the default Effect-TS loop) + **ClaudeCode** (the ComposedAgent adapter) + the provider catalog |

## The loop as a sentence

An agent definition expresses WHAT it does; the driver decides HOW the loop
runs. The same definition runs on a scripted test driver, the default model
loop, or Claude Code - unchanged.

```ts
const Planner = Agent
  .define("planner", (task: string) => AgentContext.text("Plan: " + task))
  .returns(Until.schema(Plan))     // the loop's termination = the output type
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

Structured concurrency holds throughout: children are `forkScoped` into
the supervisor's scope, so they die with it; `wait("all" | "first")`
joins them as `ChildResult` data (completed / failed / interrupted).

## Verify

```bash
bun install
bun run typecheck          # tsc --noEmit
bun test                   # 30 tests
bun run examples           # offline examples (01, 02, 05)
bun run examples 03 --live # live provider roundtrip (config.toml + .env)
bun run examples 06 --live # live supervisor spawning real subagents
```
