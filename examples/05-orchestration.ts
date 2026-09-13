/**
 * Orchestration as the same algebra: the supervisor is an agent whose ops
 * are the runtime's coordination primitives. It creates a shared whiteboard,
 * spawns workers, declares a watch rule (fork a reviewer when a child
 * reports progress), waits, and merges. Children push their progress into
 * the supervisor's context between its steps. The model is scripted here,
 * with the cast's own models in ./lib/orchestration-models.ts;
 * 06-live-orchestration.ts runs the same shape on a real provider.
 */
import { Effect, Layer } from "effect"
import {
  Agent, AgentContext, ConsoleHook, Harness, Until,
} from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime, childBinding, runtimeBinding, type Model } from "@effect-agent/builtin"
import { reviewerDriver, scannerModel, workerModel } from "./lib/orchestration-models.ts"

const registry = {
  worker: Agent.define("worker", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .writes(childBinding)
    .implementedBy(EffectAgent.make({ model: workerModel("completed the narrow investigation") })),
  scanner: Agent.define("scanner", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .writes(childBinding)
    .implementedBy(EffectAgent.make({ model: scannerModel() })),
  reviewer: Agent.define("reviewer", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .implementedBy(reviewerDriver)
}

// the supervisor's scripted model drives the real runtime ops
const supervisorModel = (): Model => {
  const script: Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }> = [
    { text: "", toolCalls: [{ id: "c1", name: "create_board", input: { name: "findings" } }] },
    { text: "", toolCalls: [
      { id: "c2", name: "spawn_agent", input: { agent: "worker", task: "investigate latency", wait: false } },
      { id: "c3", name: "spawn_agent", input: {
        agent: "worker", task: "investigate saturation", wait: false,
        watch: [{ when: { kind: "progress" }, spawn: { agent: "reviewer", task: "review progress" } }]
      } }
    ] },
    { text: "", toolCalls: [{ id: "c4", name: "wait_children", input: { mode: "all" } }] },
    { text: "", toolCalls: [{ id: "c5", name: "map_children", input: { agent: "scanner", tasks: ["alpha", "beta", "gamma"], concurrency: 2 } }] },
    { text: "", toolCalls: [{ id: "c6", name: "read_board", input: { board: "ea://board/findings" } }] },
    { text: "Merged: two worker findings plus three scans; the reviewer was forked on progress.", toolCalls: [] }
  ]
  return {
    generate: () => {
      const next = script.shift()
      return Effect.succeed(next ? { text: next.text, toolCalls: next.toolCalls ?? [] } : { text: "done", toolCalls: [] })
    }
  }
}

const Supervisor = Agent
  .define("supervisor", (goal: string) => AgentContext.text("Goal: " + goal))
  .returns(Until.text)
  .writes(runtimeBinding)
  .implementedBy(Harness.withHooks(EffectAgent.make({ model: supervisorModel(), maxSteps: 12 }), ConsoleHook))

const answer = await Effect.runPromise(
  Effect.map(Supervisor.run("cut the release"), (value) => value).pipe(
    Effect.scoped,
    Effect.provide(Layer.mergeAll(FiberAgentRuntime.layer(registry), FiberAgentRuntime.registry(registry)))
  )
)
console.log("supervisor:", answer)
