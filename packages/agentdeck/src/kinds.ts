/**
 * The agent kinds agentdeck knows by name.
 *
 * The shared vocabulary of the other three type modules: `flow.ts`,
 * `consent-types.ts` and `config-types.ts` all name a kind, so it lives here
 * rather than in either of the two that would otherwise import each other.
 */

/** a known agent kind. Unknown kinds still work via the registry but are
 *  carried as "custom" by id. */
export type AgentKind =
  | "effect"
  | "claude-code"
  | "codex"
  | "gemini"
  | "pi"
  | "claude-cc"
  | "effect-ops"
  | "demo"
  | "custom"

/** canonical agent kinds present out of the box */
export const KNOWN_KINDS: ReadonlyArray<AgentKind> = ["effect", "effect-ops", "claude-code", "claude-cc", "codex", "gemini", "pi", "demo"]
