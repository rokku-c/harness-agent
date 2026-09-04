/**
 * ResourceGovernor - the heart of the board: all-or-nothing atomic resource
 * claims. Exclusive resources allow exactly one holder; shared resources
 * many holders up to capacity; a claim group commits only when EVERY claim
 * fits (no partial grabs). A non-fitting item PARKs its intent; any release
 * re-evaluates parked waiters (priority, then FIFO) and grants whoever now
 * fits - the item flips to doing via onGranted. Split by concept into
 * ./governor/: types.ts (contract), claims.ts (pure fitness/commit rules),
 * queue.ts (waiter ordering), ops.ts (atomic transition effects), and this
 * thin class shell exposing them.
 */
import { Effect, Ref } from "effect"
import type { Resource, ResourceClaim } from "../domain.ts"
import type { EventBus } from "../events.ts"
import type { Priority, WaitEntry } from "./types.ts"
import { acquireEffect, parkEffect, cancelWaitEffect, releaseEffect, wakeEffect } from "./ops.ts"

export class ResourceGovernor {
  readonly #held: Ref.Ref<ReadonlyMap<string, ReadonlyMap<string, number>>>
  readonly #waiters: Ref.Ref<ReadonlyArray<WaitEntry>>
  readonly #resources: Ref.Ref<ReadonlyMap<string, Resource>>
  readonly #bus: EventBus
  readonly #onGranted: ((itemId: string) => Effect.Effect<void>) | undefined

  private constructor(options: {
    held: Ref.Ref<ReadonlyMap<string, ReadonlyMap<string, number>>>
    waiters: Ref.Ref<ReadonlyArray<WaitEntry>>
    resources: Ref.Ref<ReadonlyMap<string, Resource>>
    bus: EventBus
    onGranted?: (itemId: string) => Effect.Effect<void>
  }) {
    this.#held = options.held
    this.#waiters = options.waiters
    this.#resources = options.resources
    this.#bus = options.bus
    this.#onGranted = options.onGranted
  }

  static make = (options: {
    resources: Ref.Ref<ReadonlyMap<string, Resource>>
    bus: EventBus
    onGranted?: (itemId: string) => Effect.Effect<void>
  }): Effect.Effect<ResourceGovernor> =>
    Effect.gen(function* () {
      const held = yield* Ref.make<ReadonlyMap<string, ReadonlyMap<string, number>>>(new Map())
      const waiters = yield* Ref.make<ReadonlyArray<WaitEntry>>([])
      return new ResourceGovernor({ held, waiters, resources: options.resources, bus: options.bus, onGranted: options.onGranted })
    })

  /** snapshot of current holdings: resourceId -> itemId -> amount */
  holdings(): Effect.Effect<{ held: ReadonlyMap<string, ReadonlyMap<string, number>> }> {
    return Ref.get(this.#held).pipe(Effect.map((all) => ({ held: all })))
  }

  /** whether this item currently holds any resource */
  isHolding(itemId: string): Effect.Effect<boolean> {
    return Ref.get(this.#held).pipe(Effect.map((all) => [...all.values()].some((byItem) => byItem.has(itemId))))
  }

  /** one atomic attempt: grant the whole group or nothing */
  tryAcquire(itemId: string, claims: ReadonlyArray<ResourceClaim>, priority: Priority): Effect.Effect<boolean> {
    return acquireEffect(this.#held, this.#resources, this.#bus, itemId, claims, priority)
  }

  /** non-blocking: record that this item WANTS its claims (parked until granted) */
  park(itemId: string, claims: ReadonlyArray<ResourceClaim>, priority: Priority): Effect.Effect<void> {
    return parkEffect(this.#waiters, this.#bus, itemId, claims, priority)
  }

  /** remove any wait entry without granting it (item cancelled/blocked) */
  cancelWait(itemId: string): Effect.Effect<void> {
    return cancelWaitEffect(this.#waiters, itemId)
  }

  /** release everything this item holds, then re-evaluate parked waiters */
  release(itemId: string): Effect.Effect<void> {
    return releaseEffect(this.#held, this.#bus, itemId, this.wake())
  }

  /** after a release: grant every parked waiter that now fits (priority, then FIFO) */
  wake(): Effect.Effect<void> {
    return wakeEffect(this.#held, this.#resources, this.#bus, this.#waiters, this.#onGranted)
  }
}
