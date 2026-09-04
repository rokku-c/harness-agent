/** governor/ops.ts - the GOVERNOR EFFECTS (state transitions).
 *  Concept: each transition is one atomic effect over the held/waiters refs
 *  + bus: acquire commits the whole claim group or nothing (idempotent for
 *  a holder), park records intent on a deferred, cancel removes a wait
 *  entry un-granted, release drops holdings then wakes parked waiters.
 *  Pure rules come from ./claims.ts + ./queue.ts. */
import { Deferred, Effect, Ref } from "effect"
import type { Resource, ResourceClaim } from "../domain.ts"
import type { EventBus } from "../events.ts"
import type { WaitEntry, Priority } from "./types.ts"
import { commitClaims, removeHoldings } from "./claims.ts"
import { orderWaiters } from "./queue.ts"

type HeldRef = Ref.Ref<ReadonlyMap<string, ReadonlyMap<string, number>>>
type WaiterRef = Ref.Ref<ReadonlyArray<WaitEntry>>
type ResourceRef = Ref.Ref<ReadonlyMap<string, Resource>>

/** one atomic attempt: grant the whole group or nothing (idempotent) */
export const acquireEffect = (
  held: HeldRef,
  resources: ResourceRef,
  bus: EventBus,
  itemId: string,
  claims: ReadonlyArray<ResourceClaim>,
  _priority: Priority
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const all = yield* Ref.get(held)
    if ([...all.values()].some((byItem) => byItem.has(itemId))) return true
    const resourceMap = yield* Ref.get(resources)
    const next = commitClaims(all, resourceMap, claims, itemId)
    if (next === null) return false
    yield* Ref.set(held, next)
    yield* bus.push({ type: "resource.acquired", itemId, message: "claims acquired (" + claims.map((c) => c.resourceId).join(",") + ")" })
    return true
  })

/** non-blocking: record that this item WANTS its claims (parked until granted) */
export const parkEffect = (
  waiters: WaiterRef,
  bus: EventBus,
  itemId: string,
  claims: ReadonlyArray<ResourceClaim>,
  priority: Priority
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const current = yield* Ref.get(waiters)
    if (current.some((w) => w.itemId === itemId)) return // already parked
    const deferred = yield* Deferred.make<void>()
    yield* Ref.update(waiters, (ws) => [...ws, { itemId, claims, priority, enqueuedAt: Date.now(), deferred }])
    yield* bus.push({ type: "item.state", itemId, message: "parked: waiting for resources (" + claims.map((c) => c.resourceId).join(",") + ")" })
  })

/** remove any wait entry without granting it (item cancelled/blocked) */
export const cancelWaitEffect = (waiters: WaiterRef, itemId: string): Effect.Effect<void> =>
  Ref.update(waiters, (ws) => ws.filter((w) => w.itemId !== itemId))

/** release everything the item holds, then wake parked waiters */
export const releaseEffect = (
  held: HeldRef,
  bus: EventBus,
  itemId: string,
  wake: Effect.Effect<void>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const all = yield* Ref.get(held)
    const { next, changed } = removeHoldings(all, itemId)
    if (changed) {
      yield* Ref.set(held, next)
      yield* bus.push({ type: "resource.released", itemId, message: "resources released" })
      yield* wake
    }
  })

/** after a release: grant every parked waiter that now fits (priority, then FIFO) */
export const wakeEffect = (
  held: HeldRef,
  resources: ResourceRef,
  bus: EventBus,
  waiters: WaiterRef,
  onGranted: ((itemId: string) => Effect.Effect<void>) | undefined
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const current = yield* Ref.get(waiters)
    if (current.length === 0) return
    for (const entry of orderWaiters(current)) {
      const granted = yield* acquireEffect(held, resources, bus, entry.itemId, entry.claims, entry.priority)
      if (granted) {
        yield* Ref.update(waiters, (ws) => ws.filter((w) => w.itemId !== entry.itemId))
        if (onGranted !== undefined) yield* onGranted(entry.itemId)
      }
    }
  })
