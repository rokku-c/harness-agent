export interface ConsentAsk {
  readonly callId: string
  readonly sessionId: string
  readonly tool: string
  readonly input: unknown
  readonly askedAt: number
}

export type ConsentDecision = "pending" | "allow" | "deny"

export interface ConsentEntry extends ConsentAsk {
  readonly decision: ConsentDecision
  readonly decidedAt?: number
  readonly by?: string
}

export interface ConsentLedger {
  readonly entries: (sessionId?: string) => ReadonlyArray<ConsentEntry>
  readonly pending: () => ReadonlyArray<ConsentAsk>
  readonly mapping: () => ReadonlyMap<string, ReadonlyArray<ConsentEntry>>
  readonly resolve: (callId: string, allow: boolean, by?: string) => boolean
  readonly ask: (sessionId: string, tool: string, input: unknown) => string
}
