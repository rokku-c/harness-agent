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

export interface SendOutcome {
  readonly ok: boolean
  readonly text?: string
  readonly detail?: string
  readonly awaiting?: ReadonlyArray<string>
}

export interface SessionTurn {
  readonly role: "user" | "agent"
  readonly content: string
  readonly at: number
}

export interface OpenSessionRequest {
  readonly sessionId?: string
  readonly prompt?: string
  readonly config: UnifiedAgentConfig
}

export interface SessionGateway {
  readonly kind: AgentKind
  readonly open: (request: OpenSessionRequest) => Promise<SessionStatus>
  readonly close: (sessionId: string) => Promise<void>
  readonly send: (sessionId: string, text: string) => Promise<SendOutcome>
  readonly status: (sessionId: string) => Promise<SessionStatus>
  readonly sessions: () => ReadonlyArray<SessionStatus>
  readonly history?: (sessionId: string) => ReadonlyArray<SessionTurn> | Promise<ReadonlyArray<SessionTurn>>
}
