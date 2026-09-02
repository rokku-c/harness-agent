/**
 * Store: the replaceable persistence seam (E4 State). Stateful elements
 * (session state, memory, checkpoints) persist through a Store; swapping
 * MemoryStore for JsonlStore/SQLite is a Layer change, not a code change.
 */
import { Context, Effect, Layer, Ref } from "effect"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

export interface QuerySpec {
  readonly type?: string
  readonly since?: number
  readonly limit?: number
}

export interface StoreService {
  readonly get: (key: string) => Effect.Effect<unknown | undefined>
  readonly put: (key: string, value: unknown) => Effect.Effect<void>
  readonly query: (spec: QuerySpec) => Effect.Effect<ReadonlyArray<unknown>>
  readonly transaction: <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<A, E>
}

export class Store extends Context.Tag("effect-agent/Store")<Store, StoreService>() {}

interface StoredValue {
  readonly type?: string
  readonly createdAt: number
  readonly value: unknown
}

/** Default implementation: in-memory Ref map - open-box default (M1). */
export const MemoryStore = Effect.gen(function* () {
  const map = yield* Ref.make(new Map<string, StoredValue>())
  const service: StoreService = {
    get: (key) => Effect.map(Ref.get(map), (entries) => entries.get(key)?.value),
    put: (key, value) =>
      Ref.update(map, (entries) => {
        const next = new Map(entries)
        const previous = next.get(key)
        const type =
          previous?.type ??
          (typeof value === "object" && value !== null && "type" in value
            ? String((value as { type: unknown }).type)
            : undefined)
        next.set(key, { type, createdAt: previous?.createdAt ?? Date.now(), value })
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

interface JsonlRow {
  readonly key: string
  readonly stored: StoredValue
}

/** Replaceable implementation: append-only JSONL file (production-ish default). */
export class JsonlStore implements StoreService {
  private rows: ReadonlyArray<JsonlRow> = []
  constructor(private readonly path: string) {
    if (existsSync(path)) {
      this.rows = readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as JsonlRow)
    }
  }
  get = (key: string) =>
    Effect.sync(() => {
      for (let index = this.rows.length - 1; index >= 0; index--) {
        if (this.rows[index]!.key === key) return this.rows[index]!.stored.value
      }
      return undefined
    })
  put = (key: string, value: unknown) =>
    Effect.sync(() => {
      const previous = this.rows.findLast((row) => row.key === key)
      const stored: StoredValue = {
        type:
          previous?.stored.type ??
          (typeof value === "object" && value !== null && "type" in value
            ? String((value as { type: unknown }).type)
            : undefined),
        createdAt: previous?.stored.createdAt ?? Date.now(),
        value
      }
      this.rows = [...this.rows.filter((row) => row.key !== key), { key, stored }]
      writeFileSync(this.path, this.rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8")
    })
  query = (spec: QuerySpec) =>
    Effect.sync(() =>
      this.rows
        .map((row) => row.stored)
        .filter(
          (entry) =>
            (!spec.type || entry.type === spec.type) && (!spec.since || entry.createdAt >= spec.since)
        )
        .map((entry) => entry.value)
        .slice(0, spec.limit ?? 100)
    )
  transaction = <A, E>(effect: Effect.Effect<A, E>) => effect
}

export const JsonlStoreLayer = (path: string): Layer.Layer<Store> =>
  Layer.succeed(Store, new JsonlStore(path))
