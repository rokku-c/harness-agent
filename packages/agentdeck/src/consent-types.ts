/**
 * The CONSENT map: every session keeps a normalized ledger of
 * sessionId -> approvals (tool calls waiting / allowed / denied, who or what
 * decided, when).
 *
 * The ledger that implements this shape is `consent.ts`. Pure types: no logic
 * here.
 */

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
