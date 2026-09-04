/** board/context.ts - the SHARED TRANSITION CONTEXT.
 *  Concept: every api slice works over one context: tables + bus + governor
 *  + save(), with moveState (guarded legal transition + event + persist) and
 *  releaseAndCancelWait as the two shared state-machine helpers. */
import { Effect, Ref } from "effect"
import type { WorkItem } from "../domain.ts"
import { canTransition } from "../domain.ts"
import type { Tables } from "../store.ts"
import { persist } from "../store.ts"
import type { ResourceGovernor } from "../governor.ts"
import type { EventBus } from "../events.ts"
import type { BoardDeps } from "./contract.ts"

export interface BoardCtx {
  readonly tables: Tables
  readonly bus: EventBus
  readonly governor: ResourceGovernor
  readonly save: () => Effect.Effect<void>
  readonly moveState: (itemId: string, to: WorkItem["state"]) => Effect.Effect<{ ok: boolean; detail?: string }>
  readonly releaseAndCancelWait: (itemId: string) => Effect.Effect<void>
}

export const makeCtx = (deps: BoardDeps): BoardCtx => {
  const { tables, bus, governor, dataFile } = deps
  const save = (): Effect.Effect<void> => persist(dataFile, tables)
  const moveState = (itemId: string, to: WorkItem["state"]): Effect.Effect<{ ok: boolean; detail?: string }> =>
    Effect.gen(function* () {
      const items = yield* Ref.get(tables.items)
      const item = items.get(itemId)
      if (item === undefined) return { ok: false, detail: "no such item" }
      if (item.state === to) return { ok: true, detail: "unchanged" }
      if (!canTransition(item.state, to))
        return { ok: false, detail: item.state + " -> " + to + " is not a legal transition" }
      const updated: WorkItem = { ...item, state: to, updatedAt: Date.now() }
      yield* Ref.update(tables.items, (m) => new Map(m).set(itemId, updated))
      yield* bus.push({ type: "item.state", itemId, message: item.state + " -> " + to })
      yield* save()
      return { ok: true, detail: undefined }
    })
  const releaseAndCancelWait = (itemId: string): Effect.Effect<void> =>
    Effect.gen(function* () {
      yield* governor.cancelWait(itemId)
      yield* governor.release(itemId)
    })
  return { tables, bus, governor, save, moveState, releaseAndCancelWait }
}
