/**
 * The CONFIG map: every agent's raw configuration normalizes to this ONE
 * `UnifiedAgentConfig` shape, and adapters render it back to that agent's own
 * CLI/config dialect.
 *
 * The normalizer that produces it is `config.ts`. Pure types: no logic here.
 */

import type { AgentKind } from "./kinds.ts"

/**
 * One MCP server a launch must be able to call, as the platform states it: where
 * the door is, and the token that names the principal at it (§F10).
 *
 * The token is held apart from the header it will be written into because the
 * dialects disagree about where a secret belongs — `claude` has only an argv
 * route, `codex` insists on reading it from the environment — and a shape that
 * had already spelled the header would force one of them to un-spell it.
 */
export interface LaunchMcpServer {
  readonly url: string
  readonly token: string
}

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
  /**
   * The MCP servers this agent must be able to reach, by the name the platform
   * knows them by. Absent means it needs none — which is a different state from
   * one whose dialect could not be told, and only the second is a refusal.
   *
   * `normalizeConfig` never fills this: a config read back from a saved launcher
   * or a console form has no `mcp` however its raw object was spelled, because
   * the only thing that supplies one is a launch the platform armed. A secret
   * therefore reaches a process through exactly one route, and no surface that
   * *draws* a config can be drawing one.
   */
  readonly mcp?: Readonly<Record<string, LaunchMcpServer>>
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
