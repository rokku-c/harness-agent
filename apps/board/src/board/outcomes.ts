/** board/outcomes.ts - REPORT / CANCEL / BLOCK / UNBLOCK.
 *  Concept: report (only from doing) moves to the terminal outcome and
 *  releases claims; cancel/block drop waiters + release first; unblock
 *  returns a blocked item to ready. Every move is guarded + persisted. */
import { Effect, Ref } from "effect"
import type { BoardApi } from "./contract.ts"
import type { BoardCtx } from "./context.ts"
import { unblockDependents } from "../domain.ts"

export const outcomeSlice = (ctx: BoardCtx): Pick<BoardApi, "report" | "cancel" | "block" | "unblock"> => {
  const { tables, bus, governor, save, moveState, releaseAndCancelWait } = ctx
  return {
    report: (itemId, outcome, detail) =>
      Effect.gen(function* () {
        const items = yield* Ref.get(tables.items)
        const item = items.get(itemId)
        if (item === undefined) return { ok: false, detail: "no such item" }
        if (item.state !== "doing") return { ok: false, detail: "only a doing item can report; state is " + item.state }
        const result = yield* moveState(itemId, outcome)
        if (!result.ok) return result
        yield* governor.release(itemId)
        yield* Ref.update(tables.items, (m) => {
          const current = m.get(itemId)
          if (current === undefined) return m
          const updated = new Map(m).set(itemId, { ...current, result: detail, updatedAt: Date.now() })
          return outcome === "done" ? unblockDependents(updated, itemId) : updated
        })
        yield* save()
        return { ok: true, detail: outcome }
      }),
    cancel: (itemId) =>
      Effect.gen(function* () {
        const items = yield* Ref.get(tables.items)
        const item = items.get(itemId)
        if (item === undefined) return { ok: false, detail: "no such item" }
        if (item.state === "done" || item.state === "cancelled") return { ok: false, detail: "already terminal" }
        yield* releaseAndCancelWait(itemId)
        return yield* moveState(itemId, "cancelled")
      }),
    block: (itemId, reason) =>
      Effect.gen(function* () {
        const items = yield* Ref.get(tables.items)
        const item = items.get(itemId)
        if (item === undefined) return { ok: false, detail: "no such item" }
        yield* releaseAndCancelWait(itemId)
        yield* Ref.update(tables.items, (m) => {
          const current = m.get(itemId)
          if (current === undefined) return m
          return new Map(m).set(itemId, { ...current, state: "blocked", blockedReason: reason, updatedAt: Date.now() })
        })
        yield* bus.push({ type: "item.state", itemId, message: "blocked: " + reason })
        yield* save()
        return { ok: true, detail: reason }
      }),
    unblock: (itemId) =>
      Effect.gen(function* () {
        const items = yield* Ref.get(tables.items)
        const item = items.get(itemId)
        if (item === undefined) return { ok: false, detail: "no such item" }
        if (item.state !== "blocked") return { ok: true, detail: "not blocked" }
        const updated = { ...item, state: "ready" as const, blockedReason: undefined, updatedAt: Date.now() }
        yield* Ref.update(tables.items, (m) => new Map(m).set(itemId, updated))
        yield* bus.push({ type: "item.state", itemId, message: "blocked -> ready (unblocked)" })
        yield* save()
        return { ok: true, detail: "unblocked" }
      })
  }
}
