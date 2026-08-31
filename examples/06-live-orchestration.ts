/**
 * Live: a real supervisor on a real provider orchestrating real subagents -
 * it creates a board, spawns workers (passing the board uri in the task),
 * waits for them, reads the board and merges. Requires config.toml + .env.
 * Run: bun run examples 06 --live
 */
import { Effect, Layer } from "effect"
import { Agent, AgentContext, ConsoleHook, Harness, Until, type Binding } from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime, Providers, runtimeBinding } from "@effect-agent/builtin"

// least privilege: workers may post to and read boards, but never spawn -
// coordination bindings are just bindings, so scoping is data, not policy
const childRuntime = (): Binding => ({
  uri: runtimeBinding.uri,
  ops: (runtimeBinding.ops ?? []).filter((op) => op.name === "post_board" || op.name === "read_board")
})

const program = Effect.gen(function* () {
  const model = yield* Effect.map(Providers, (catalog) => catalog.model())

  const registry = {
    worker: Agent.define("worker", (task: string) => AgentContext.text(task))
      .returns(Until.text)
      .writes(childRuntime())
      .implementedBy(Harness.withHooks(EffectAgent.make({ model, maxSteps: 6 }), ConsoleHook)),
    reviewer: Agent.define("reviewer", (task: string) => AgentContext.text(task))
      .returns(Until.text)
      .implementedBy(EffectAgent.make({ model, maxSteps: 4 }))
  }
  const runtimeLayer = Layer.mergeAll(FiberAgentRuntime.layer(registry), FiberAgentRuntime.registry(registry))

  const Supervisor = Agent
    .define("supervisor", (goal: string) => AgentContext.text("Goal: " + goal))
    .returns(Until.text)
    .writes(runtimeBinding)
    .implementedBy(Harness.withHooks(EffectAgent.make({ model, maxSteps: 12 }), ConsoleHook))

  return yield* Effect.map(
    Supervisor.run("Investigate what makes effect-agent's loop design good. First create a board. Then spawn TWO workers with narrow questions; each worker's task MUST tell it to post exactly ONE finding via post_board to the board uri you created. Then wait_children, then read_board, then merge the findings into a short summary."),
    (value) => value
  ).pipe(Effect.scoped, Effect.provide(runtimeLayer))
})

const answer = await Effect.runPromise(
  Effect.map(program, (value) => value).pipe(Effect.provide(Providers.layer()))
)
console.log("supervisor:", answer)

