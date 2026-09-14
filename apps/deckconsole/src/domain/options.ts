import type { UnifiedAgentConfig } from "@effect-agent/agentdeck"
import type { ClaudeCodeOptions } from "@effect-agent/builtin"
import type { Model } from "@effect-agent/model"

export interface Launcher { kind: string; label: string; config?: unknown }
export interface DeckOptions {
  readonly effectModel?: (config: UnifiedAgentConfig) => Model
  readonly claudeSdk?: { readonly query: NonNullable<ClaudeCodeOptions["query"]> }
  readonly launchers?: ReadonlyArray<Launcher>
  readonly configFile?: string
}
