import type { UnifiedAgentConfig } from "@effect-agent/agentdeck"
import type { Model, ClaudeCodeOptions } from "@effect-agent/builtin"

export interface Launcher { kind: string; label: string; config?: unknown }
export interface DeckOptions {
  readonly effectModel?: (config: UnifiedAgentConfig) => Model
  readonly claudeSdk?: { readonly query: NonNullable<ClaudeCodeOptions["query"]> }
  readonly launchers?: ReadonlyArray<Launcher>
  readonly configFile?: string
  readonly basePath?: string
}
