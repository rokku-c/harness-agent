/** board/assembly.ts - assemble the faceted BoardService.
 *  Concept: makeBoard wires Store + EventBus + ResourceGovernor (its
 *  onGranted flips a parked waiter to doing + persists) and builds the api
 *  by merging the concept slices: reads / item-create / start / outcomes /
 *  exec-res, all over one shared context. */
import { Effect, Ref } from "effect"
import { makeTables, persist } from "../store.ts"
import { EventBus } from "../events.ts"
import { ResourceGovernor } from "../governor.ts"
import type { BoardApi, BoardDeps, BoardOptions } from "./contract.ts"
import { makeCtx } from "./context.ts"
import { readsSlice } from "./reads.ts"
import { createItemSlice } from "./item-create.ts"
import { startSlice } from "./start.ts"
import { outcomeSlice } from "./outcomes.ts"
import { execResSlice } from "./exec-res.ts"
import { makeProbeGateway } from "../launch.ts"

const buildApi = (deps: BoardDeps): BoardApi => {
  const ctx = makeCtx(deps)
  return {
    probe: deps.probe,
    persist: () => persist(deps.dataFile, deps.tables),
    ...readsSlice(deps),
    ...createItemSlice(ctx),
    ...startSlice(ctx),
    ...outcomeSlice(ctx),
    ...execResSlice(ctx)
  }
}

export const makeBoard = (options?: BoardOptions): Effect.Effect<BoardApi> =>
  Effect.gen(function* () {
    const tables = yield* makeTables(options?.dataFile)
    const bus = yield* EventBus.make()
    const governor = yield* ResourceGovernor.make({
      resources: tables.resources,
      bus,
      // when a parked waiter is granted by a release, the item goes doing
      onGranted: (itemId) =>
        Effect.gen(function* () {
          const items = yield* Ref.get(tables.items)
          const item = items.get(itemId)
          if (item === undefined || (item.state !== "blocked" && item.state !== "ready")) return
          yield* Ref.update(tables.items, (m) => new Map(m).set(itemId, { ...item, state: "doing", blockedReason: undefined, updatedAt: Date.now() }))
          yield* bus.push({ type: "item.state", itemId, message: item.state + " -> doing (resource granted)" })
          yield* persist(options?.dataFile, tables)
        })
    })
    return buildApi({ tables, bus, governor, dataFile: options?.dataFile, probe: makeProbeGateway() })
  })
