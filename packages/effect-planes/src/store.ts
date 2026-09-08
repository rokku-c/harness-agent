/** NodeStore — unified document KV storage for a node (JSON values, prefix list). */

export interface NodeStore {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  delete(key: string): boolean
  list(prefix?: string): readonly string[]
}

export const makeNodeStore = (): NodeStore => {
  const data = new Map<string, unknown>()
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value)
    },
    delete: (key) => data.delete(key),
    list: (prefix = "") => [...data.keys()].filter((k) => k.startsWith(prefix)),
  }
}
