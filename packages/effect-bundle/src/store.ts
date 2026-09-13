/**
 * The reference store — a capability implementation, like `runtime.ts`.
 *
 * A node's documents in one flat namespace: JSON values under string keys, with
 * a prefix list. That is the whole shape an app is promised when a host hands
 * it `storage`, so it is deliberately the smallest thing that can keep a
 * promise — a Map. A host with durability injects a store of its own instead
 * (`RuntimeCapabilities.storage` is an interface, not this constructor).
 */

export interface NodeStore {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  delete(key: string): boolean
  list(prefix?: string): readonly string[]
}

/** A store in this process's memory. It does not survive the process. */
export const makeNodeStore = (): NodeStore => {
  const data = new Map<string, unknown>()
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value)
    },
    delete: (key) => data.delete(key),
    list: (prefix = "") => [...data.keys()].filter((key) => key.startsWith(prefix)),
  }
}
