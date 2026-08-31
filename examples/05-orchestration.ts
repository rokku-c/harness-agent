/**
 * Orchestration as the same algebra: the supervisor is an agent whose ops
 * are the runtime's coordination primitives. It creates a shared whiteboard,
 * spawns workers, declares a watch rule (fork a reviewer when a child
 * reports progress), waits, and merges. Children push their progress into
 * the supervisor's context between its steps. The model is scripted here;
 * 06-live-orchestration.ts runs the same shape on a real provider.
 */
import { Effect, Layer, Schema } from "effect"
import {
  Agent, AgentContext, AgentRuntime, ConsoleHook, Harness, Op, Until, notationText,
  type Binding, type Driver, type RunRequest
} from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime, runtimeBinding, type Model, type WireMessage } from "@effect-agent/builtin"

const postBoard = (): Binding => ({
  uri: "ea://svc/post/main",
  ops: [Op.read({
    name: "post_board",
    description: notationText("Post a finding to the shared whiteboard."),
    input: Schema.Struct({ text: Schema.String }),
    output: Schema.Struct({ posted: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.flatMap(AgentRuntime, (rt) =>
        Effect.map(rt.postBoard("ea://board/findings", "worker", (input as { text: string }).text), () => ({ posted: true }))
      )
  })]
})

const reportProgress = (): Binding => ({
  uri: "ea://svc/progress/main",
  ops: [Op.read({
    name: "report_progress",
    description: notationText("Report progress to your supervisor."),
    input: Schema.Struct({ text: Schema.String }),
    output: Schema.Struct({ reported: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.flatMap(AgentRuntime, (rt) =>
        Effect.map(rt.emitProgress("worker", (input as { text: string }).text), () => ({ reported: true }))
      )
  })]
})

// a worker: reports progress, posts one finding, finishes
const workerModel = (finding: string): Model => {
  let calls = 0
  return {
    generate: (_s: string, _m: ReadonlyArray<WireMessage>) => {
      calls++
      if (calls === 1) return Effect.succeed({ text: "", toolCalls: [{ id: "p", name: "report_progress", input: { text: "working on " + finding } }] })
      if (calls === 2) return Effect.succeed({ text: "", toolCalls: [{ id: "b", name: "post_board", input: { board: "ea://board/findings", text: finding } }] })
      return Effect.succeed({ text: "done: " + finding, toolCalls: [] })
    }
  }
}

const reviewerDriver: Driver<never> = {
  id: "reviewer",
  capabilities: { provider: { _tag: "Configurable" }, granularity: "run", thinking: false, cancel: true, pause: true, resume: false, fork: "none", tools: "native", toolCalls: "intercept", structuredOutput: "text", sandbox: "none" },
  run: <A, R>(_request: RunRequest<A, R>) => Effect.succeed("reviewed" as A)
}

const reviewerProgram = Agent.define("reviewer", (task: string) => AgentContext.text(task))
  .returns(Until.text)
  .implementedBy(reviewerDriver)

const registry = {
  worker: Agent.define("worker", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .writes(runtimeBinding)
    .uses(postBoard())
    .uses(reportProgress())
    .implementedBy(EffectAgent.make({ model: workerModel("completed the narrow investigation") })),
  reviewer: reviewerProgram
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
    { text: "", toolCalls: [{ id: "c5", name: "read_board", input: { board: "ea://board/findings" } }] },
    { text: "Merged findings from both workers; the reviewer was forked on progress.", toolCalls: [] }
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

