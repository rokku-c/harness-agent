import type { UIDataStore } from "./data.ts"

export interface UIDataSource {
  read(signal?: AbortSignal): Promise<Record<string, unknown>>
}

export interface UIDataSync {
  refresh(signal?: AbortSignal): Promise<Record<string, unknown>>
}

export const fetchDataSource = (url: string, init?: RequestInit): UIDataSource => ({
  read: async (signal) => {
    const response = await fetch(url, { ...init, signal: signal ?? init?.signal })
    if (!response.ok) throw new Error(`data source request failed: ${response.status}`)
    const value: unknown = await response.json()
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("data source must return a JSON object")
    }
    return value as Record<string, unknown>
  }
})

export const syncDataSource = (store: UIDataStore, source: UIDataSource): UIDataSync => ({
  refresh: async (signal) => {
    const data = await source.read(signal)
    for (const [key, value] of Object.entries(data)) store.set(key, value)
    return store.snapshot()
  }
})
