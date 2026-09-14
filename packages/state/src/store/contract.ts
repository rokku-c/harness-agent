import { Context, Effect } from "effect"

export interface QuerySpec {
  readonly type?: string
  readonly limit?: number
}

export interface StoreService {
  readonly get: (key: string) => Effect.Effect<unknown | undefined>
  readonly put: (key: string, value: unknown) => Effect.Effect<void>
  readonly query: (spec: QuerySpec) => Effect.Effect<ReadonlyArray<unknown>>
  readonly transaction: <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<A, E>
}

export class Store extends Context.Tag("effect-agent/Store")<Store, StoreService>() {}

export interface StoredValue {
  readonly type?: string
  readonly createdAt: number
  readonly value: unknown
}

export const deriveMeta = (previous: StoredValue | undefined, value: unknown): Pick<StoredValue, "type" | "createdAt"> => ({
  type:
    previous?.type ??
    (typeof value === "object" && value !== null && "type" in value
      ? String((value as { type: unknown }).type)
      : undefined),
  createdAt: previous?.createdAt ?? Date.now()
})
