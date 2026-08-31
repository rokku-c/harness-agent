/**
 * Live: a real supervisor on a real provider orchestrating real subagents -
 * it creates a board, spawns workers (passing the board uri in the task),
 * waits for them, reads the board and merges. Requires config.toml + .env.
 * Run: bun run examples 06 --live
 */
import { Effect, Layer } from "effect"
import { Agent, AgentContext, ConsoleHook, Harness, Until } from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime, Providers, childBinding, runtimeBinding } from "@effect-agent/builtin"

const program = Effect.gen(function* () {
  const model = yield* Effect.map(Providers, (catalog) => catalog.model())

  const registry = {
    worker: Agent.define("worker", (task: string) => AgentContext.text(task))
      .returns(Until.text)
      .writes(childBinding)
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
    .implementedBy(Harness.withHooks(EffectAgent.make({
      model,
      maxSteps: 18,
      instructions: "You are a supervisor. Execute the plan exactly ONCE: create_board, then spawn_agent twice, then wait_children, then read_board, then output the merged summary as your final text. Never repeat a phase; never spawn more than two workers; after reading the board, finish immediately."
    }), ConsoleHook))

  return yield* Effect.map(
    Supervisor.run("Investigate what makes effect-agent's loop design good. First create a board. Then spawn TWO workers with narrow questions; each worker's task MUST tell it to post exactly ONE finding via post_board to the board uri you created. Then wait_children, then read_board, then merge the findings into a short summary."),
    (value) => value
  ).pipe(Effect.scoped, Effect.provide(runtimeLayer))
})

const answer = await Effect.runPromise(
  Effect.map(program, (value) => value).pipe(Effect.provide(Providers.layer()))
)
console.log("supervisor:", answer)

