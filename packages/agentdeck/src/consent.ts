/**
 * agentdeck/consent - the SESSION -> CONSENT MAP (ask 2).
 *
 * A normalized ledger per session: every ask (tool needing the operator) is
 * recorded once; resolves flip pending entries to allow/deny and stamp who
 * decided. The map is exposed directly so a caller (or the product layer on
 * top) can render "what is session X asking, and what did it get".
 */
import type { ConsentEntry, ConsentLedger } from "./types.ts"

export interface ConsentLedgerOptions {
  /** answer pending asks automatically when their tool is on this list */
  readonly autoApproveTools?: ReadonlyArray<string>
}

/** internal writable form; the public surface stays readonly */
type MutableEntry = { -readonly [K in keyof ConsentEntry]: ConsentEntry[K] }

export const makeConsentLedger = (options: ConsentLedgerOptions = {}): ConsentLedger => {
  const entries: Array<MutableEntry> = []
  const byId = new Map<string, MutableEntry>()
  const auto = new Set(options.autoApproveTools ?? [])

  const ask = (sessionId: string, tool: string, input: unknown): string => {
    const callId = "ask-" + Date.now().toString(36) + "-" + (entries.length + 1).toString(36)
    const entry: MutableEntry = { callId, sessionId, tool, input, askedAt: Date.now(), decision: "pending" }
    if (auto.has(tool)) {
      entry.decision = "allow"
      entry.decidedAt = Date.now()
      entry.by = "auto"
    }
    entries.push(entry)
    byId.set(callId, entry)
    return callId
  }

  return {
    entries: (sessionId?: string) => {
      const all = [...entries].reverse()
      return (sessionId === undefined ? all : all.filter((e) => e.sessionId === sessionId)) as ReadonlyArray<ConsentEntry>
    },
    pending: () =>
      entries
        .filter((e) => e.decision === "pending")
        .map(({ callId, sessionId, tool, input, askedAt }) => ({ callId, sessionId, tool, input, askedAt })),
    mapping: () => {
      const out = new Map<string, Array<MutableEntry>>()
      for (const e of entries) {
        const list = out.get(e.sessionId) ?? []
        list.push(e)
        out.set(e.sessionId, list)
      }
      return out as ReadonlyMap<string, ReadonlyArray<ConsentEntry>>
    },
    resolve: (callId: string, allow: boolean, by = "operator") => {
      const entry = byId.get(callId)
      if (entry === undefined || entry.decision !== "pending") return false
      entry.decision = allow ? "allow" : "deny"
      entry.decidedAt = Date.now()
      entry.by = by
      return true
    },
    ask
  }
}
