/**
 * agentdeck - the middle-abstraction control plane over mainstream agents.
 *
 * What it normalizes, per the product brief:
 *   1. FLOW control   - start/stop/send one agent conversation the same way,
 *                       no matter which agent kind is behind it (claude code,
 *                       codex, gemini, pi, effect-agent "self", ...)
 *   2. CONSENT map    - every session keeps a normalized ledger of
 *                       sessionId -> approvals (tool calls waiting / allowed /
 *                       denied, who/what decided, when)
 *   3. CONFIG map     - every agent's raw config normalizes to ONE
 *                       UnifiedAgentConfig shape; adapters render it to that
 *                       agent's own CLI/config dialect.
 * Pure types: no logic in this module.
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

/** one declared tool/action that may need operator consent */
export interface ConsentAsk {
  readonly callId: string
  readonly sessionId: string
  readonly tool: string
  readonly input: unknown
  readonly askedAt: number
}

export type ConsentDecision = "pending" | "allow" | "deny"

/** one ledger entry of a session's consent lifecycle */
export interface ConsentEntry extends ConsentAsk {
  readonly decision: ConsentDecision
  readonly decidedAt?: number
  /** who decided: the operator ("operator"), an auto policy ("auto"), ... */
  readonly by?: string
}

/** session -> consent mapping (the ask-2 surface) */
export interface ConsentLedger {
  /** all recorded entries, newest last, optionally filtered to one session */
  readonly entries: (sessionId?: string) => ReadonlyArray<ConsentEntry>
  /** pending asks across sessions, oldest first */
  readonly pending: () => ReadonlyArray<ConsentAsk>
  /** the normalized map itself: sessionId -> its ledger */
  readonly mapping: () => ReadonlyMap<string, ReadonlyArray<ConsentEntry>>
  /** answer one pending ask */
  readonly resolve: (callId: string, allow: boolean, by?: string) => boolean
  /** record an ask (adapters feed their gate/approval events here) */
  readonly ask: (sessionId: string, tool: string, input: unknown) => string
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

export type SessionStatusTag = "opening" | "running" | "idle" | "closed" | "failed"

export interface SessionStatus {
  readonly sessionId: string
  readonly kind: AgentKind
  readonly status: SessionStatusTag
  readonly lastActivityAt?: number
  readonly detail?: string
}

/** result of one send() turn */
export interface SendOutcome {
  readonly ok: boolean
  /** the agent's final reply text when a turn completed */
  readonly text?: string
  readonly detail?: string
  /** consent asks this turn is waiting on (effect-ops style gateways) */
  readonly awaiting?: ReadonlyArray<string>
}

/** how a caller asks for a session (ask-1 surface) */
/** one recorded turn inside a session transcript */
export interface SessionTurn {
  readonly role: "user" | "agent"
  readonly content: string
  readonly at: number
}

export interface OpenSessionRequest {
  /** optional explicit session id; generated when absent */
  readonly sessionId?: string
  /** the seed/task of the conversation */
  readonly prompt?: string
  readonly config: UnifiedAgentConfig
}

/** the middle-abstraction session gateway ONE agent kind implements */
export interface SessionGateway {
  readonly kind: AgentKind
  /** open a session (flow control 1a) */
  readonly open: (request: OpenSessionRequest) => Promise<SessionStatus>
  /** end a session (flow control 1b) */
  readonly close: (sessionId: string) => Promise<void>
  /** run one turn inside a session (flow control 1c); resolves at terminal */
  readonly send: (sessionId: string, text: string) => Promise<SendOutcome>
  /** read a session's status (flow control 1d) */
  readonly status: (sessionId: string) => Promise<SessionStatus>
  /** sessions this gateway currently knows */
  readonly sessions: () => ReadonlyArray<SessionStatus>
  /** optional per-session transcript (flow-control agents keep one) */
  readonly history?: (sessionId: string) => ReadonlyArray<SessionTurn> | Promise<ReadonlyArray<SessionTurn>>
}
