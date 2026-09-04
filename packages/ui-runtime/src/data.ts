export interface UIDataStore {
  get(path?: string): unknown
  set(path: string, value: unknown): void
  snapshot(): Record<string, unknown>
  subscribe(listener: () => void): () => void
}

const parts = (path: string): string[] => path.replace(/^\$\.?/, "").split(".").filter(Boolean)
const forbidden = new Set(["__proto__", "constructor", "prototype"])

export const makeUIDataStore = (initial: Record<string, unknown> = {}): UIDataStore => {
  let state: Record<string, unknown> = structuredClone(initial)
  const listeners = new Set<() => void>()
  const get = (path = "") => parts(path).reduce<unknown>(
    (value, key) => value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)[key] : undefined, state)
  const set = (path: string, value: unknown): void => {
    const keys = parts(path)
    if (keys.length === 0) throw new Error("data path is required")
    if (keys.some((key) => forbidden.has(key))) throw new Error("unsafe data path")
    const next = structuredClone(state)
    let cursor: Record<string, unknown> = next
    keys.slice(0, -1).forEach((key) => {
      const child = cursor[key]
      cursor[key] = child !== null && typeof child === "object" ? child : {}
      cursor = cursor[key] as Record<string, unknown>
    })
    cursor[keys.at(-1)!] = value
    state = next
    listeners.forEach((listener) => listener())
  }
  return {
    get, set, snapshot: () => structuredClone(state),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
