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

export const KNOWN_KINDS: ReadonlyArray<AgentKind> = ["effect", "effect-ops", "claude-code", "claude-cc", "codex", "gemini", "pi", "demo"]
