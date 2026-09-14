import type { EffectRegistry } from "@effect-agent/effect-interface"

export type AppsPlane = "interface" | "ui" | "store" | "config"

export interface NodeStore {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  delete(key: string): boolean
  list(prefix?: string): readonly string[]
}

export interface AppUiPlane {
  doc(): unknown
  state?(): unknown
}

export interface AppConfigPlane {
  schema?(): unknown
  value?(): unknown
  sources?(): unknown
}

export interface AppEntry {
  readonly ns: string
  readonly appId: string
  readonly registry?: EffectRegistry
  readonly ui?: AppUiPlane
  readonly config?: AppConfigPlane
  readonly store?: NodeStore
  authorize?(op: AppsPlane): boolean
}

export interface AppCatalog {
  list(): readonly AppEntry[]
  find(ns: string, appId: string): AppEntry | undefined
}

export interface MutableAppCatalog extends AppCatalog {
  register(app: AppEntry): () => void
}

export const appKey = (ns: string, appId: string): string => `${ns}::${appId}`

export const makeAppCatalog = (): MutableAppCatalog => {
  const apps = new Map<string, AppEntry>()
  return {
    register(app: AppEntry): () => void {
      const key = appKey(app.ns, app.appId)
      apps.set(key, app)
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        if (apps.get(key) === app) apps.delete(key)
      }
    },
    list: () => [...apps.values()],
    find: (ns, appId) => apps.get(appKey(ns, appId)),
  }
}
