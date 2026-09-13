/**
 * store/contract.ts - the STORE CONTRACT.
 *
 * Concept: stateful elements (session state, memory, checkpoints) persist
 * through a Store - one replaceable seam. This file owns the service shape
 * and the shared row metadata rule (type carried forward, createdAt kept
 * from the first write).
 */
import { Context, Effect } from "effect"

export interface QuerySpec {
  readonly type?: string
  /**
   * At most this many rows, and they are the NEWEST - the end a page of a log is
   * read from. Absent means every matching row. Either way rows come back oldest
   * first, so a caller reading a page reads a suffix of what it would have read
   * whole.
   *
   * The store never invents a bound. It had one - a hundred rows, oldest first -
   * and no caller could see it: `checkpoint.list()` read as "the checkpoints"
   * and answered with the first hundred ever written, and the gateway's audit
   * answered "the fifty most recent" with events fifty-one to a hundred of all
   * time, which stopped moving once there were more. A caller that wants a page
   * says how big, and a caller that wants everything asks for everything.
   */
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
  /** When this key first appeared. A key rewritten keeps its first reading, so
   *  this orders rows by arrival and is not a stamp a cursor can follow. */
  readonly createdAt: number
  readonly value: unknown
}

/** row metadata: keep the first type/createdAt across overwrites */
export const deriveMeta = (previous: StoredValue | undefined, value: unknown): Pick<StoredValue, "type" | "createdAt"> => ({
  type:
    previous?.type ??
    (typeof value === "object" && value !== null && "type" in value
      ? String((value as { type: unknown }).type)
      : undefined),
  createdAt: previous?.createdAt ?? Date.now()
})
