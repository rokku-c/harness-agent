import { Deferred, Effect, Layer, Schema } from "effect"
import { Agent, AgentContext, AgentRuntime, CheckpointStore, Op, Until, notationText, type Binding } from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime } from "@effect-agent/builtin"

const noopBinding = (): Binding => ({
  uri: "ea://svc/noop/main",
  ops: [Op.read({
    name: "noop",
    description: notationText("Does nothing."),
    input: Schema.Struct({}),
    output: Schema.Struct({ ok: Schema.Boolean }),
    execute: () => Effect.succeed({ ok: true })
  })]
})

let calls = 0
const gate = Effect.runSync(Deferred.make<void>())
const agents = {
  worker: Agent.define("worker", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .uses(noopBinding())
    .implementedBy(EffectAgent.make({
      model: {
        generate: () =>
          Effect.gen(function* () {
            if (calls === 0) yield* Deferred.await(gate)
            calls++
            return calls < 3
              ? { text: "", toolCalls: [{ id: "t" + calls, name: "noop", input: {} }] }
              : { text: "finished after resume", toolCalls: [] }
          })
      },
      sensitivities: [{ _tag: "TimeSensitive" }, { _tag: "ExternalEffects" }]
    }))
}

const runtimeLayer = Layer.mergeAll(
  FiberAgentRuntime.layer(agents),
  FiberAgentRuntime.registry(agents)
)

const walk = Effect.gen(function* () {
  const rt = yield* AgentRuntime
  const store = yield* CheckpointStore

  const spawned = yield* rt.spawn("worker", "quarterly audit")
  yield* rt.pause(spawned.childId)
  yield* Deferred.succeed(gate, undefined).pipe(Effect.asVoid)
  const paused = yield* rt.join(spawned.childId)
  console.log("paused:", paused.status, "checkpoint:", paused.checkpointRef?.slice(0, 8))

  const stored = yield* store.get({ runId: paused.checkpointRef! })
  console.log("archived task:", stored?.task)
  console.log("archived sensitivities:", JSON.stringify(stored?.sensitivities))

  const resumed = yield* rt.resume(paused.checkpointRef!)
  const done = yield* rt.join(resumed.childId)
  console.log("resumed:", done.status, "->", done.output)
})

await Effect.runPromise(Effect.map(walk, (v) => v).pipe(Effect.scoped, Effect.provide(runtimeLayer)))
