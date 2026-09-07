export interface UIDataStore {
  get(path?: string): unknown
  set(path: string, value: unknown): void
  snapshot(): Record<string, unknown>
  subscribe(listener: () => void): () => void
}

const parts = (path: string): string[] => path.replace(/^\$\.?/, "").split(".").filter(Boolean)
const forbidden = new Set(["__proto__", "constructor", "prototype"])
const pointer = (path: string): string => "/" + parts(path).join("/")

export const makeUIDataStore = (initial: Record<string, unknown> = {}): UIDataStore => {
  const store = createStateStore(structuredClone(initial))
  const get = (path = "") => path === "" ? store.getSnapshot() : store.get(pointer(path))
  const set = (path: string, value: unknown): void => {
    const keys = parts(path)
    if (keys.length === 0) throw new Error("data path is required")
    if (keys.some((key) => forbidden.has(key))) throw new Error("unsafe data path")
    store.set(pointer(path), value)
  }
  return {
    get, set,
    snapshot: () => structuredClone(store.getSnapshot()),
    subscribe: store.subscribe
  }
}
import { createStateStore } from "@json-render/core"
