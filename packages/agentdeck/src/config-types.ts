/**
 * The CONFIG map: every agent's raw configuration normalizes to this ONE
 * `UnifiedAgentConfig` shape, and adapters render it back to that agent's own
 * CLI/config dialect.
 *
 * The normalizer that produces it is `config.ts`. Pure types: no logic here.
 */

import type { AgentKind } from "./kinds.ts"

/** normalized, agent-kind-agnostic configuration (the ask-3 surface) */
export interface UnifiedAgentConfig {
  readonly kind: AgentKind
  /** human label, falls back to the kind */
  readonly label?: string
  /** working directory the agent runs in */
  readonly cwd: string
  /** language model selector (name/endpoint or a model-provider ref) */
  readonly model?: string
  /** path/command of the agent executable (CLI adapters) */
  readonly command?: string
  /** extra arguments pinned for CLI adapters, in order */
  readonly args?: ReadonlyArray<string>
  /** environment variable overrides for the agent process */
  readonly env?: ReadonlyMap<string, string>
  /** per-turn wall-clock cap (ms) for the send() flow */
  readonly turnTimeoutMs?: number
  /** consent policy for this session's asks */
  readonly consent?: {
    /** tools always allowed without asking */
    readonly autoApproveTools?: ReadonlyArray<string>
    /** how unresolved asks behave: ask the operator (default) or auto-allow */
    readonly defaultDecision?: "ask" | "allow" | "deny"
  }
  /** any agent-specific extra settings (declared per kind, passed through) */
  readonly extra?: Readonly<Record<string, unknown>>
}
