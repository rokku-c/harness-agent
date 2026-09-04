/** board/exec-res.ts - EXECUTORS + RESOURCES writes.
 *  Concept: registerExecutor upserts (idle + lastSeen), heartbeat refreshes
 *  lastSeen only; createResource rejects duplicates and capacity < 1. */
import { Effect, Ref } from "effect"
import type { BoardApi } from "./contract.ts"
import type { BoardCtx } from "./context.ts"

export const execResSlice = (ctx: BoardCtx): Pick<BoardApi, "registerExecutor" | "heartbeat" | "createResource"> => {
  const { tables, bus, save } = ctx
  return {
    registerExecutor: (executorId, kind, name, capability) =>
      Effect.gen(function* () {
        yield* Ref.update(tables.executors, (m) => new Map(m).set(executorId, {
          executorId, kind, name, capability, status: "idle", lastSeen: Date.now()
        }))
        yield* bus.push({ type: "executor.registered", executorId, message: name })
        yield* save()
        return { ok: true }
      }),
    heartbeat: (executorId) =>
      Effect.gen(function* () {
        const executors = yield* Ref.get(tables.executors)
        const current = executors.get(executorId)
        if (current === undefined) return { ok: false }
        yield* Ref.update(tables.executors, (m) => new Map(m).set(executorId, { ...current, lastSeen: Date.now() }))
        return { ok: true }
      }),
    createResource: (input) =>
      Effect.gen(function* () {
        const resources = yield* Ref.get(tables.resources)
        if (resources.has(input.resourceId)) return { ok: false, detail: "resource exists" }
        if (input.capacity < 1) return { ok: false, detail: "capacity must be >= 1" }
        yield* Ref.update(tables.resources, (m) => new Map(m).set(input.resourceId, {
          resourceId: input.resourceId,
          kind: input.kind,
          name: input.name,
          capacity: input.capacity,
          concurrency: input.concurrency,
          description: undefined
        }))
        yield* bus.push({ type: "resource.created", resourceId: input.resourceId, message: input.name })
        yield* save()
        return { ok: true, detail: undefined }
      })
  }
}
