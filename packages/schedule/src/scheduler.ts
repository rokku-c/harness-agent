/**
 * Scheduler: the timed/autonomous trigger seam (E13). Triggers are data
 * (Interval/At); the default implementation is process-local timers, and an
 * external cron/queue can implement the same service. Call dispose() to
 * stop every registered job (or swap in a scoped Layer for auto-cleanup).
 */
import { Context, Effect, Layer, Ref } from "effect"
import { randomUUID } from "node:crypto"

export type Trigger =
  | { readonly _tag: "Interval"; readonly everyMs: number }
  | { readonly _tag: "At"; readonly at: number }

export interface ScheduledJob {
  readonly id: string
  readonly trigger: Trigger
  readonly task: string
  readonly nextRunAt: number
}

export interface SchedulerService {
  readonly register: (trigger: Trigger, task: string, run: Effect.Effect<void>) => Effect.Effect<string>
  readonly cancel: (id: string) => Effect.Effect<void>
  readonly jobs: () => Effect.Effect<ReadonlyArray<ScheduledJob>>
  /** Stop every registered job and clear timers. */
  readonly dispose: () => Effect.Effect<void>
}

export class Scheduler extends Context.Tag("effect-agent/Scheduler")<Scheduler, SchedulerService>() {}

/** Default implementation: process-local timers with explicit disposal. */
export const IntervalScheduler = Effect.gen(function* () {
  const jobs = yield* Ref.make<ReadonlyArray<ScheduledJob>>([])
  const handles = new Map<string, ReturnType<typeof setInterval>>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const service: SchedulerService = {
    register: (trigger, task, run) =>
      Effect.gen(function* () {
        const id = randomUUID()
        const fire = () => {
          // leveled, replaceable via Effect's Logger provider - never a raw console
          Effect.runPromise(run.pipe(Effect.tapError((error) => Effect.logError("[schedule] job failed: " + task, error)))).catch(() => {})
        }
        if (trigger._tag === "Interval") {
          const handle = setInterval(fire, trigger.everyMs)
          handles.set(id, handle)
          yield* Ref.update(jobs, (current) => [
            ...current,
            { id, trigger, task, nextRunAt: Date.now() + trigger.everyMs }
          ])
        } else {
          const delay = Math.max(0, trigger.at - Date.now())
          const timer = setTimeout(() => {
            fire()
            timers.delete(id)
          }, delay)
          timers.set(id, timer)
          yield* Ref.update(jobs, (current) => [
            ...current,
            { id, trigger, task, nextRunAt: trigger.at }
          ])
        }
        return id
      }),
    cancel: (id) =>
      Effect.sync(() => {
        const handle = handles.get(id)
        if (handle !== undefined) {
          clearInterval(handle)
          handles.delete(id)
        }
        const timer = timers.get(id)
        if (timer !== undefined) {
          clearTimeout(timer)
          timers.delete(id)
        }
        return Ref.update(jobs, (current) => current.filter((job) => job.id !== id))
      }).pipe(Effect.flatten),
    jobs: () => Ref.get(jobs),
    dispose: () =>
      Effect.sync(() => {
        for (const handle of handles.values()) clearInterval(handle)
        for (const timer of timers.values()) clearTimeout(timer)
        handles.clear()
        timers.clear()
        return Ref.set(jobs, [])
      }).pipe(Effect.flatten)
  }
  return service
})

export const IntervalSchedulerLayer: Layer.Layer<Scheduler> = Layer.effect(Scheduler, IntervalScheduler)
