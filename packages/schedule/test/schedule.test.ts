import { describe, expect, it } from "bun:test"
import { Effect, Ref } from "effect"
import { IntervalScheduler, Scheduler } from "@effect-agent/schedule"

describe("Scheduler", () => {
  it("Interval trigger fires a job repeatedly until cancelled", async () => {
    const state = await Effect.runPromise(Effect.gen(function* () {
      const scheduler = yield* IntervalScheduler
      const counter = yield* Ref.make(0)
      const id = yield* scheduler.register(
        { _tag: "Interval", everyMs: 20 },
        "tick",
        Ref.update(counter, (n) => n + 1)
      )
      return { scheduler, counter, id }
    }))
    await new Promise((resolve) => setTimeout(resolve, 90))
    const count = await Effect.runPromise(Ref.get(state.counter))
    expect(count).toBeGreaterThanOrEqual(2)
    await Effect.runPromise(state.scheduler.cancel(state.id))
    const after = await Effect.runPromise(Ref.get(state.counter))
    await new Promise((resolve) => setTimeout(resolve, 50))
    const settled = await Effect.runPromise(Ref.get(state.counter))
    expect(after).toBeGreaterThanOrEqual(2)
    expect(settled).toBe(after)
    await Effect.runPromise(state.scheduler.dispose())
  })

  it("At trigger fires once after the deadline", async () => {
    const result = await Effect.runPromise(Effect.gen(function* () {
      const scheduler = yield* IntervalScheduler
      const fired = yield* Ref.make(false)
      yield* scheduler.register({ _tag: "At", at: Date.now() + 30 }, "once", Ref.set(fired, true))
      yield* Effect.sleep("60 millis")
      return yield* Ref.get(fired)
    }))
    expect(result).toBe(true)
  })

  it("jobs are listed with their triggers", async () => {
    const state = await Effect.runPromise(Effect.gen(function* () {
      const scheduler = yield* IntervalScheduler
      yield* scheduler.register({ _tag: "Interval", everyMs: 1000 }, "a", Effect.void)
      yield* scheduler.register({ _tag: "At", at: Date.now() + 5000 }, "b", Effect.void)
      return scheduler
    }))
    const jobs = await Effect.runPromise(state.jobs())
    expect(jobs.map((job) => job.task)).toEqual(["a", "b"])
    expect(jobs[0]!.trigger._tag).toBe("Interval")
    await Effect.runPromise(state.dispose())
  })
})
