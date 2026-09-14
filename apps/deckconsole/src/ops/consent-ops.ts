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
