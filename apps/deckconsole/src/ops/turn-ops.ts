/**
 * A turn, and the retry that runs the last one again.
 *
 * A turn the agent stopped on a consent ask is kept as that session's pending
 * text, so the retry sends the text it kept instead of asking the operator to
 * type it a second time - which is why retry declares no text of its own. A
 * session that is already running refuses a new turn rather than queueing it,
 * and a turn still waiting on consent answers with the calls it is waiting for.
 */
import { z } from "@effect-agent/effect-config"
import { operation, type Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { Refusal, refuse } from "./refusal.ts"

/** One turn's move. A retry re-sends what the session kept, so it carries no text. */
const send = async ({ deck, sessionGateway, lastTurn }: DeckDomain, id: string, text: string | undefined, retry: boolean): Promise<unknown> => {
  const said = retry ? lastTurn.get(id) : text ?? ""
  if (said === undefined) refuse(404, "no pending turn to retry")
  const gateway = sessionGateway(id)
  if (!gateway) refuse(404, "unknown session")
  if (deck.sessions().find(s => s.sessionId === id)?.status === "running") refuse(409, "session busy: " + id)
  const out = await gateway.send(id, said)
  // a turn waiting on consent is the only one worth keeping; anything else was answered
  if (!out.ok && out.awaiting?.length) lastTurn.set(id, said)
  else lastTurn.delete(id)
  if (out.ok) return { ok: true, text: out.text, ...(retry ? { retried: true } : {}) }
  throw new Refusal(422, { ok: false, detail: out.detail, ...(out.awaiting ? { awaiting: out.awaiting } : {}) })
}

export const turnOperations = (domain: DeckDomain): readonly Operation[] => [
  operation({
    name: "deckconsole_send_turn",
    description: "Send one turn of text to a session and answer with the agent's reply; a turn that needs consent refuses with the calls it is waiting on",
    input: z.object({ id: z.string().min(1), text: z.string().optional() }).strict(),
    http: { method: "POST", path: "/api/session/:id/send" },
    handler: (input) => send(domain, input.id, input.text, false),
  }),
  operation({
    name: "deckconsole_retry_turn",
    description: "Send again the last turn a session stopped on, once the consent it waited for has been decided",
    input: z.object({ id: z.string().min(1) }).strict(),
    http: { method: "POST", path: "/api/session/:id/retry" },
    handler: (input) => send(domain, input.id, undefined, true),
  }),
  operation({
    name: "deckconsole_session_history",
    description: "The transcript of one session and the consent decisions recorded for it, newest decision first",
    access: "read",
    input: z.object({ id: z.string().min(1) }).strict(),
    http: { method: "GET", path: "/api/session/:id/history" },
    handler: async (input) => {
      const { deck, sessionGateway } = domain
      return {
        ok: true, sessionId: input.id,
        turns: await sessionGateway(input.id)?.history?.(input.id) ?? [],
        consent: (deck.consent.mapping().get(input.id) ?? []).slice().reverse(),
      }
    },
  }),
]
