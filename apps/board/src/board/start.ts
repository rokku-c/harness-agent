/** board/start.ts - the START workflow.
 *  Concept: start requires deps done (else blocked), assigns the executor
 *  and parks a waiter: no claims -> doing now; claims granted -> doing;
 *  otherwise blocked("waiting for resources") and the governor grants the
 *  parked waiter on the next release (item flips to doing by itself). */
import { Effect, Ref } from "effect"
import type { BoardApi } from "./contract.ts"
import type { BoardCtx } from "./context.ts"
import { dependenciesDone } from "./rules.ts"

export const startSlice = (ctx: BoardCtx): Pick<BoardApi, "start"> => {
  const { tables, bus, governor, save, moveState } = ctx
  return {
    start: (itemId, executorId) =>
      Effect.gen(function* () {
        const items = yield* Ref.get(tables.items)
        const item = items.get(itemId)
        if (item === undefined) return { ok: false, state: "", detail: "no such item" }
        if (item.state !== "todo" && item.state !== "ready" && item.state !== "blocked")
          return { ok: false, state: item.state, detail: "cannot start from " + item.state }
        const deps = dependenciesDone(item, items)
        if (!deps.ok) {
          const moved = yield* moveState(itemId, "blocked")
          void moved
          return { ok: false, state: "blocked", detail: "waiting on dependencies: " + deps.missing.join(", ") }
        }
        const executors = yield* Ref.get(tables.executors)
        if (!executors.has(executorId))
          yield* Ref.update(tables.executors, (m) => new Map(m).set(executorId, {
            executorId, kind: "external", name: executorId, capability: [], status: "idle", lastSeen: Date.now()
          }))
        const claims = item.requires ?? []
        yield* Ref.update(tables.items, (m) => {
          const current = m.get(itemId)
          if (current === undefined) return m
          return new Map(m).set(itemId, { ...current, assigneeId: executorId, state: "ready", updatedAt: Date.now() })
        })
        if (claims.length === 0) {
          const moved = yield* moveState(itemId, "doing")
          void moved
          return { ok: true, state: "doing", detail: undefined }
        }
        const granted = yield* governor.tryAcquire(itemId, claims, item.priority)
        if (granted) {
          yield* moveState(itemId, "doing")
          return { ok: true, state: "doing", detail: "resources granted" }
        }
        yield* governor.park(itemId, claims, item.priority)
        const current = yield* Ref.get(tables.items)
        const parked = current.get(itemId)
        if (parked !== undefined) {
          yield* Ref.update(tables.items, (m) => new Map(m).set(itemId, { ...parked, state: "blocked", blockedReason: "waiting for resources", updatedAt: Date.now() }))
          yield* bus.push({ type: "item.state", itemId, message: "-> blocked (waiting for resources)" })
        }
        yield* save()
        return { ok: false, state: "blocked", detail: "waiting for resources" }
      })
  }
}
