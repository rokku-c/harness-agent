/**
 * The FLOW surface: start, talk to and stop one agent conversation the same way
 * no matter which agent kind is behind it (claude code, codex, gemini, pi,
 * effect-agent "self", ...).
 *
 * One of agentdeck's three normalization axes. The other two are
 * `consent-types.ts` (the consent map) and `config-types.ts` (the config map);
 * the kinds both of them name are `kinds.ts`. Pure types: no logic here.
 */

import type { AgentKind } from "./kinds.ts"
import type { UnifiedAgentConfig } from "./config-types.ts"

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

/** one recorded turn inside a session transcript */
export interface SessionTurn {
  readonly role: "user" | "agent"
  readonly content: string
  readonly at: number
}

/** how a caller asks for a session (ask-1 surface) */
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
