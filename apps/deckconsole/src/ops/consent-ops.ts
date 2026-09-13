/**
 * The consent ledger, and the operator's decisions on it.
 *
 * Nothing an agent asks to run happens until one of these is decided, so the
 * ledger is readable on its own and every decision on it is a write. The bulk
 * decision is declared before the single one because both are a POST to a path
 * of the same shape: the literal segment is the only thing that tells them
 * apart, and the first declaration that matches a request is the one answering.
 */
import { z } from "@effect-agent/effect-config"
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { refuse } from "./refusal.ts"

export const consentOperations = ({ deck }: DeckDomain): readonly Operation[] => [
  operation({
    name: "deckconsole_consent_log",
    description: "Every consent ask this deck has recorded, with the decision made on each one and who made it",
    access: "read", input: noInput,
    http: { method: "GET", path: "/api/consent" },
    handler: () => ({ ok: true, entries: deck.consent.entries() }),
  }),
  operation({
    name: "deckconsole_decide_pending_consent",
    description: "Decide every consent ask still waiting with one answer, and report how many were decided",
    input: z.object({ allow: z.boolean().optional() }).strict(),
    http: { method: "POST", path: "/api/consent/bulk" },
    handler: (input) => {
      // only a true allows; an absent or non-boolean answer denies, which is the safe half
      const allow = input.allow === true
      let decided = 0
      for (const ask of deck.consent.pending()) if (deck.consent.resolve(ask.callId, allow, "operator")) decided++
      return { ok: true, decided }
    },
  }),
  operation({
    name: "deckconsole_decide_consent",
    description: "Allow or deny one consent ask by its call id on the operator's behalf; an id already decided is refused",
    input: z.object({ callId: z.string().min(1), allow: z.boolean().optional() }).strict(),
    http: { method: "POST", path: "/api/consent/:callId" },
    handler: (input) => deck.consent.resolve(input.callId, input.allow === true, "operator")
      ? { ok: true, allow: input.allow === true }
      : refuse(404, "unknown or already decided call id"),
  }),
]
