/**
 * Opening and closing sessions - the moves the control room exists for.
 *
 * A session's config arrives raw and is normalized for the kind it opens, so
 * the declaration takes that raw shape and hands normalization the same value
 * the route always did. A kind is either one the deck serves or a preset an
 * operator registered, and an id already in use is refused rather than replaced:
 * two sessions under one id would be one session the page could not address.
 */
import { normalizeConfig } from "@effect-agent/agentdeck"
import { z } from "@effect-agent/effect-config"
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { refuse } from "./refusal.ts"

/** The raw config an operator pastes; normalizing it is the deck's job, not the caller's. */
const rawConfig = z.record(z.string(), z.unknown())

export const sessionOperations = ({ deck, presets, gatewayFor, sessionPolicy, closeSession }: DeckDomain): readonly Operation[] => [
  operation({
    name: "deckconsole_open_session",
    description: "Open a session of one agent kind from its raw config, which the deck normalizes; a kind the deck does not serve, or an id already open, is refused",
    input: z.object({
      kind: z.string().min(1).optional(), sessionId: z.string().optional(),
      prompt: z.string().optional(), config: rawConfig.optional(),
    }).strict(),
    http: { method: "POST", path: "/api/session" },
    handler: async (input) => {
      const kind = input.kind ?? "demo"
      if (!presets.known(kind) && deck.get(kind) === undefined) {
        refuse(404, "unknown agent kind: " + kind + " (register a preset via POST /api/presets or use custom)")
      }
      const config = normalizeConfig(kind as never, input.config ?? {})
      if (input.sessionId !== undefined && deck.sessions().some(s => s.sessionId === input.sessionId)) {
        refuse(409, "session already open: " + input.sessionId)
      }
      const opened = await gatewayFor(kind).open({ sessionId: input.sessionId, prompt: input.prompt, config })
      // a policy the config asked for lives exactly as long as its own session
      const auto = config.consent?.autoApproveTools
      const mode = config.consent?.defaultDecision as "ask" | "allow" | "deny" | undefined
      if (auto !== undefined && auto.length > 0) sessionPolicy.set(opened.sessionId, { auto: new Set(auto), mode: mode ?? "ask" })
      else if (mode !== undefined && mode !== "ask") sessionPolicy.set(opened.sessionId, { auto: new Set<string>(), mode })
      return { ok: true, session: opened }
    },
  }),
  operation({
    name: "deckconsole_close_session",
    description: "Close one session by its id, along with the consent policy and the pending turn that belonged to it",
    input: z.object({ id: z.string().min(1) }).strict(),
    http: { method: "POST", path: "/api/session/:id/close" },
    handler: async (input) => { await closeSession(input.id); return { ok: true } },
  }),
  operation({
    name: "deckconsole_close_sessions",
    description: "Close every session the deck has open and report how many were closed",
    input: noInput,
    http: { method: "POST", path: "/api/sessions/close-all" },
    handler: async () => {
      const open = deck.sessions()
      await Promise.all(open.map((session) => closeSession(session.sessionId)))
      return { ok: true, closed: open.length }
    },
  }),
]
