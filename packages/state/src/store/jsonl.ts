/**
 * store/jsonl.ts - JsonlStore: the production-ish default.
 *
 * Concept: one append-only JSONL file per store (rewrite-on-write keeps one
 * row per key). Loads existing rows at construction; swap MemoryStore for
 * this is a Layer change, not a code change.
 */
import { Effect, Layer } from "effect"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { Store, deriveMeta, type StoreService } from "./contract.ts"
import type { QuerySpec, StoredValue } from "./contract.ts"

interface JsonlRow {
  readonly key: string
  readonly stored: StoredValue
}

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
      const stored: StoredValue = { ...deriveMeta(previous?.stored, value), value }
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
