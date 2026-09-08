import { Effect } from "effect"
import { TypeOrmStore } from "@effect-agent/storage-typeorm"

interface LogValue<T> { readonly type: string; readonly order: number; readonly value: T }
export interface SQLiteLog<T> { append(value: T): Promise<void>; read(): Promise<ReadonlyArray<T>> }
const stores = new Map<string, Promise<TypeOrmStore>>()

export const makeSQLiteLog = <T>(database: string, type: string): SQLiteLog<T> => {
  const store = stores.get(database) ?? TypeOrmStore.open({ database })
  stores.set(database, store)
  let next: Promise<number> | undefined
  const rows = async () => Effect.runPromise((await store).query({ type, limit: Number.MAX_SAFE_INTEGER })) as Promise<ReadonlyArray<LogValue<T>>>
  const sequence = () => next ??= rows().then((values) => Math.max(0, ...values.map((row) => row.order)) + 1)
  return {
    append: async (value) => {
      const order = await sequence()
      next = Promise.resolve(order + 1)
      await Effect.runPromise((await store).put(`${type}/${order.toString().padStart(12, "0")}`, { type, order, value }))
    },
    read: async () => [...(await rows())].sort((a, b) => a.order - b.order).map((row) => row.value)
  }
}
