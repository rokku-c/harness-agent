import { Effect } from "effect"
import { TypeOrmStore } from "@effect-agent/storage-typeorm"

interface LogValue<T> { readonly type: string; readonly order: number; readonly value: T }
export interface SQLiteLog<T> { append(value: T): Promise<void>; read(): Promise<ReadonlyArray<T>> }
const stores = new Map<string, Promise<TypeOrmStore>>()

export const makeSQLiteLog = <T>(database: string, type: string): SQLiteLog<T> => {
  const store = stores.get(database) ?? TypeOrmStore.open({ database })
  stores.set(database, store)
  const rows = async () => Effect.runPromise((await store).query({ type, limit: Number.MAX_SAFE_INTEGER })) as Promise<ReadonlyArray<LogValue<T>>>
  const key = (order: number) => `${type}/${order.toString().padStart(12, "0")}`
  // Appends are serialized, and one append reads the last order, takes the next
  // one and writes it in a single turn. Two that start together would otherwise
  // both read the same last entry and take the same next order, so both would
  // write the same key — the store keys rows by that order and refuses the
  // second as a duplicate, so concurrent appends fail and the one that survives
  // is whichever reached the store first.
  let tail: Promise<void> = Promise.resolve()
  return {
    append: (value) => {
      const write = tail.then(async () => {
        const order = (await rows()).reduce((highest, row) => Math.max(highest, row.order), 0) + 1
        await Effect.runPromise((await store).put(key(order), { type, order, value }))
      })
      // a failed append must not strand the ones queued behind it
      tail = write.catch(() => undefined)
      return write
    },
    read: async () => [...(await rows())].sort((a, b) => a.order - b.order).map((row) => row.value)
  }
}
