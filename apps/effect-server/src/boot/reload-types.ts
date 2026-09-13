/**
 * The vocabulary of reloading, in one place because two load paths speak it: the
 * app layer's reloader (`reload.ts`) and the bundle reloader (`bundle-reload.ts`).
 */

import type { UpgradeReport } from "@effect-agent/effect-compat"

/** What one attempt to reload an app did, in enough detail to act on. */
export interface ReloadOutcome {
  readonly appId: string
  readonly ok: boolean
  /** Which generation of the app is serving. 0 is what boot loaded; 1 is the first reload. */
  readonly generation: number
  readonly reason?: "not-loaded" | "no-module" | "rejected" | "failed"
  readonly report?: UpgradeReport
  readonly error?: unknown
}

/**
 * Reloading one app in place, without restarting the server.
 *
 * Nothing here records descriptors: the generation is the record. The serving
 * generation's code is still on disk and still in the module cache, so
 * re-importing it — to re-register it as a rollback target — is a cache lookup
 * that re-runs no module-level code.
 *
 * A reload is refused rather than committed when it would break a caller that
 * already exists: a tool that disappeared, or one whose schema changed in a way
 * the policy calls strict. The old generation keeps serving, so a bad edit to a
 * running app is an error message and not an outage.
 */
export interface AppReloader {
  reload(appId: string): Promise<ReloadOutcome>
}
