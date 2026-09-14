import type { UpgradeReport } from "@effect-agent/effect-compat"

export interface ReloadOutcome {
  readonly appId: string
  readonly ok: boolean
  readonly generation: number
  readonly reason?: "not-loaded" | "no-module" | "rejected" | "failed"
  readonly report?: UpgradeReport
  readonly error?: unknown
}

export interface AppReloader {
  reload(appId: string): Promise<ReloadOutcome>
}
