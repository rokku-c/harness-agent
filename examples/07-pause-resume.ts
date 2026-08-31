/**
 * Every run is storable by default: the loop snapshots its logical state at
 * every step boundary; a Pause signal archives and stops it; resume spawns
 * the same agent hydrated from the archive, with recovery notes derived from
 * its sensitivity declarations (time-sensitive -> elapsed wall clock,
 * external-effects-sensitive -> re-validation). Offline and deterministic -
 * the scripted model proves the resumed run continues the SAME thread.
 */
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

// step 1 and 2 post a noop each; step 3 finishes. The gate only holds the
// very first call, so the pause lands deterministically mid-thread.
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

  // 1. run, then pause it mid-thread
  const spawned = yield* rt.spawn("worker", "quarterly audit")
  yield* rt.pause(spawned.childId)
  yield* Deferred.succeed(gate, undefined).pipe(Effect.asVoid)
  const paused = yield* rt.join(spawned.childId)
  console.log("paused:", paused.status, "checkpoint:", paused.checkpointRef?.slice(0, 8))

  // 2. the archive: agent, task, sensitivities, opaque step state
  const stored = yield* store.get({ runId: paused.checkpointRef! })
  console.log("archived task:", stored?.task)
  console.log("archived sensitivities:", JSON.stringify(stored?.sensitivities))

  // 3. resume: the same agent, hydrated, recovery notes injected first
  const resumed = yield* rt.resume(paused.checkpointRef!)
  const done = yield* rt.join(resumed.childId)
  console.log("resumed:", done.status, "->", done.output)
})

await Effect.runPromise(Effect.map(walk, (v) => v).pipe(Effect.scoped, Effect.provide(runtimeLayer)))

