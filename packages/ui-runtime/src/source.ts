import type { UIDataStore } from "./data.ts"

export interface UIDataSource {
  read(signal?: AbortSignal): Promise<Record<string, unknown>>
}

export interface UIDataSync {
  refresh(signal?: AbortSignal): Promise<Record<string, unknown>>
}

export const syncDataSource = (store: UIDataStore, source: UIDataSource): UIDataSync => ({
  refresh: async (signal) => {
    const data = await source.read(signal)
    for (const [key, value] of Object.entries(data)) store.set(key, value)
    return store.snapshot()
  }
})
