/**
 * effect-apps catalog — caller-supplied registry of namespaced effect apps.
 *
 * An app is ns::appId and may expose any combination of an effect-interface
 * registry (tools), a UiDocument (ui.doc) plus runtime state, a config
 * {schema,value,sources} triplet, and a NodeStore storage plane. A per-entry
 * authorize(op) gate guards each plane before it is read or invoked. The
 * catalog is provided by the caller; makeAppCatalog is a default in-memory one.
 */

import type { EffectRegistry } from "@effect-agent/effect-interface"
import { canAccessAppPlane } from "./access.ts"
import { listAppTools } from "./tools.ts"

/** Planes an app can expose, and the ops authorize() is asked about. */
export type AppsPlane = "interface" | "ui" | "store" | "config"

/**
 * Minimal JSON KV store. The same shape as `effect-bundle`'s `NodeStore`, written
 * out rather than imported: an app plane is duck-typed, so an app's store is
 * anything with these four methods and the app plane stays clear of the loader.
 */
export interface NodeStore {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  delete(key: string): boolean
  list(prefix?: string): readonly string[]
}

/** UI plane: the app's UiDocument plus an optional live state snapshot. */
export interface AppUiPlane {
  doc(): unknown
  state?(): unknown
}

/** Config plane: schema / merged value / per-key provenance as JSON data. */
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
  /** Omitted authorization denies every plane. */
  authorize?(op: AppsPlane): boolean
}

export interface AppSummary {
  readonly ns: string
  readonly appId: string
  readonly hasInterface: boolean
  readonly hasUi: boolean
  readonly hasConfig: boolean
  readonly hasStore: boolean
}

export interface AppCatalog {
  /** register an app; returns a disposer that removes exactly this entry. */
  register(app: AppEntry): () => void
  list(): readonly AppEntry[]
  find(ns: string, appId: string): AppEntry | undefined
}

export const appKey = (ns: string, appId: string): string => `${ns}::${appId}`

export const makeAppCatalog = (): AppCatalog => {
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

export const summarize = (app: AppEntry): AppSummary => ({
  ns: app.ns,
  appId: app.appId,
  hasInterface: listAppTools(app).length !== 0,
  hasUi: canAccessAppPlane(app, "ui") && app.ui !== undefined,
  hasConfig: canAccessAppPlane(app, "config") && app.config !== undefined,
  hasStore: canAccessAppPlane(app, "store") && app.store !== undefined,
})
