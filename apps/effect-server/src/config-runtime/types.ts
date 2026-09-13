import type { ConfigLayerInput, ConfigOutcome } from "@effect-agent/effect-config"

export type ApplyStrategy = "apply" | "restart"
export interface RuntimeConfigOutcome extends ConfigOutcome {
  readonly pendingRestart: boolean
  readonly revision?: number
}
export interface ConfigRuntimeOptions {
  /**
   * The file the registry persists to. Used for nothing but making a refusal
   * actionable: "operator must rebuild the store" names no store and no command,
   * and an operator who cannot follow the instruction will rewrite it by hand.
   */
  readonly storeFile?: string
}
export interface ConfigRuntime {
  initialize(appId: string, layers?: ConfigLayerInput): void
  active(appId: string): unknown
  read(appId: string): RuntimeConfigOutcome
  save(appId: string, patch: Record<string, unknown>, strategy: ApplyStrategy, unset?: readonly string[]): Promise<RuntimeConfigOutcome>
  apply(appId: string): Promise<RuntimeConfigOutcome>
}
