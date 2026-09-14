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
      Effect.map(Ref.get(map), (entries) => {
        const matching = [...entries.values()]
          .filter((entry) => !spec.type || entry.type === spec.type)
          .sort((left, right) => left.createdAt - right.createdAt)
        const page = spec.limit === undefined || matching.length <= spec.limit
          ? matching
          : matching.slice(matching.length - spec.limit)
        return page.map((entry) => entry.value)
      }),
    transaction: (effect) => effect
  }
  return service
})

export const MemoryStoreLayer: Layer.Layer<Store> = Layer.effect(Store, MemoryStore)
