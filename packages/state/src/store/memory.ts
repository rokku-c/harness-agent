/**
 * store/memory.ts - MemoryStore: the open-box default.
 *
 * Concept: an in-memory Ref map implementing the Store seam (M1). Nothing is
 * durable and no transaction machinery is needed - transaction is identity.
 */
import { Effect, Layer, Ref } from "effect"
import { Store, deriveMeta, type StoredValue, type StoreService } from "./contract.ts"

export const MemoryStore = Effect.gen(function* () {
  const map = yield* Ref.make(new Map<string, StoredValue>())
  const service: StoreService = {
    get: (key) => Effect.map(Ref.get(map), (entries) => entries.get(key)?.value),
    put: (key, value) =>
      Ref.update(map, (entries) => {
        const next = new Map(entries)
        next.set(key, { ...deriveMeta(next.get(key), value), value })
        return next
      }),
    query: (spec) =>
      Effect.map(Ref.get(map), (entries) =>
        [...entries.values()]
          .filter(
            (entry) =>
              (!spec.type || entry.type === spec.type) && (!spec.since || entry.createdAt >= spec.since)
          )
          .map((entry) => entry.value)
          .slice(0, spec.limit ?? 100)
      ),
    transaction: (effect) => effect
  }
  return service
})

export const MemoryStoreLayer: Layer.Layer<Store> = Layer.effect(Store, MemoryStore)
