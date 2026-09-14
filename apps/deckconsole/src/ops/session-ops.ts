import { normalizeConfig } from "@effect-agent/agentdeck"
import { z } from "@effect-agent/effect-config"
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { refuse } from "./refusal.ts"

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
      const sessionId = input.sessionId === "" ? undefined : input.sessionId
      if (sessionId !== undefined && deck.sessions().some(s => s.sessionId === sessionId)) {
        refuse(409, "session already open: " + sessionId)
      }
      const opened = await gatewayFor(kind).open({ sessionId, prompt: input.prompt, config })
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
