import type { ConfigLayerInput, ConfigOutcome } from "@effect-agent/effect-config"

export type ApplyStrategy = "apply" | "restart"
export interface RuntimeConfigOutcome extends ConfigOutcome {
  readonly pendingRestart: boolean
  readonly revision?: number
}
export interface ConfigRuntime {
  initialize(appId: string, layers?: ConfigLayerInput): void
  active(appId: string): unknown
  read(appId: string): RuntimeConfigOutcome
  save(appId: string, patch: Record<string, unknown>, strategy: ApplyStrategy, unset?: readonly string[]): Promise<RuntimeConfigOutcome>
  apply(appId: string): Promise<RuntimeConfigOutcome>
}
