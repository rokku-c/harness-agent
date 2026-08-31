import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Layer } from "effect"
import { Agent, AgentContext, AgentRuntime, CheckpointStore, Until } from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime, type Model, type WireMessage } from "@effect-agent/builtin"

/**
 * The first call blocks on a gate; later calls never block. The gate lets the
 * test pause the run deterministically mid-thread, and the shared call
 * counter means the RESUMED run continues where the first left off.
 */
const gatedOnceModel = (calls: { n: number }, seen: Array<ReadonlyArray<WireMessage>>) => {
  const gate = Effect.runSync(Deferred.make<void>())
  return {
    release: Deferred.succeed(gate, undefined),
    model: {
      generate: (_s: string, messages: ReadonlyArray<WireMessage>) =>
        Effect.gen(function* () {
          if (calls.n === 0) yield* Deferred.await(gate)
          calls.n++
          seen.push(messages)
          return calls.n < 2
            ? { text: "", toolCalls: [{ id: "t1", name: "noop", input: {} }] }
            : { text: "final", toolCalls: [] }
        })
    }
  }
}

const provide = (agents: Record<string, unknown>) =>
  Layer.mergeAll(FiberAgentRuntime.layer(agents as never), FiberAgentRuntime.registry(agents as never))

describe("checkpoints: every run is storable, pausable, resumable", () => {
  test("storage is on by default: a plain run snapshots every step", async () => {
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .implementedBy(EffectAgent.make({
          model: { generate: () => Effect.succeed({ text: "done", toolCalls: [] }) }
        }))
    }
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const store = yield* CheckpointStore
        const spawned = yield* rt.spawn("worker", "t1")
        yield* rt.join(spawned.childId)
        return yield* store.list()
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(outcome.length).toBeGreaterThanOrEqual(1)
    expect(outcome[0]?.agent).toBe("worker")
    expect(outcome[0]?.task).toContain("t1")
  })

  test("pause mid-thread archives; resume hydrates and finishes", async () => {
    const calls = { n: 0 }
    const seen: Array<ReadonlyArray<WireMessage>> = []
    const { release, model } = gatedOnceModel(calls, seen)
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .implementedBy(EffectAgent.make({
          model,
          sensitivities: [{ _tag: "TimeSensitive" }]
        }))
    }
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const store = yield* CheckpointStore
        const spawned = yield* rt.spawn("worker", "long task")
        yield* Effect.sleep(30)
        yield* rt.pause(spawned.childId)
        yield* release
        const paused = yield* rt.join(spawned.childId)
        const stored = yield* store.get({ runId: paused.checkpointRef! })
        const step = (stored?.payload as { step: number }).step
        const resumed = yield* rt.resume(paused.checkpointRef!)
        const done = yield* rt.join(resumed.childId)
        return { paused, step, done }
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(outcome.paused.status).toBe("paused")
    expect(outcome.paused.checkpointRef).toBeDefined()
    expect(outcome.step).toBeGreaterThanOrEqual(1)
    expect(outcome.done.status).toBe("completed")
    expect(outcome.done.output).toBe("final")
  })

  test("resume injects sensitivity-based recovery notes into the fresh context", async () => {
    const calls = { n: 0 }
    const seen: Array<ReadonlyArray<WireMessage>> = []
    const { release, model } = gatedOnceModel(calls, seen)
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .implementedBy(EffectAgent.make({
          model,
          sensitivities: [{ _tag: "TimeSensitive" }, { _tag: "ExternalEffects" }]
        }))
    }
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const store = yield* CheckpointStore
        const first = yield* rt.spawn("worker", "task")
        yield* rt.pause(first.childId)
        yield* release
        yield* rt.join(first.childId)
        const stored = yield* store.list()
        expect(stored[0]?.sensitivities).toEqual([{ _tag: "TimeSensitive" }, { _tag: "ExternalEffects" }])
        const resumed = yield* rt.resume(stored[0]!.ref.runId)
        return yield* rt.join(resumed.childId)
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(outcome.status).toBe("completed")
    const last = seen[seen.length - 1] ?? []
    expect(last.some((m) => m.role === "user" && m.content.includes("time-sensitive"))).toBe(true)
    expect(last.some((m) => m.role === "user" && m.content.includes("external-effects-sensitive"))).toBe(true)
  })
})

