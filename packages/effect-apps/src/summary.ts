/**
 * How an app is described to whoever is asking: which planes it has, and of
 * those, which its `authorize` lets through. `hasInterface` is a reading of the
 * entry's registry rather than a flag on it, so a summary cannot outlive the
 * tools it claims — and a plane the entry's own gate denies reports absent here,
 * which is the same answer the plane itself would give.
 */
import { canAccessAppPlane } from "./access.ts"
import type { AppEntry } from "./catalog.ts"
import { listAppTools } from "./tools.ts"

export interface AppSummary {
  readonly ns: string
  readonly appId: string
  readonly hasInterface: boolean
  readonly hasUi: boolean
  readonly hasConfig: boolean
  readonly hasStore: boolean
}

export const summarize = (app: AppEntry): AppSummary => ({
  ns: app.ns,
  appId: app.appId,
  hasInterface: listAppTools(app).length !== 0,
  hasUi: canAccessAppPlane(app, "ui") && app.ui !== undefined,
  hasConfig: canAccessAppPlane(app, "config") && app.config !== undefined,
  hasStore: canAccessAppPlane(app, "store") && app.store !== undefined,
})
