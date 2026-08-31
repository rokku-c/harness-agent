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

## Verify

```bash
bun install
bun run typecheck          # tsc --noEmit
bun test                   # 23 tests
bun run examples           # offline examples
bun run examples 03 --live # live provider roundtrip (config.toml + .env)
```
