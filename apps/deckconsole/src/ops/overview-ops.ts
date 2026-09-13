/**
 * What the console reads before it acts: the deck in one answer, the raw config
 * sample a kind starts from, and the preview of what a raw config becomes once
 * it is normalized for its kind.
 *
 * The preview parses the raw config here rather than in the page, so the browser
 * and an agent are told the same way when what they pasted is not JSON.
 */
import { cliInvocation, normalizeConfig } from "@effect-agent/agentdeck"
import { z } from "@effect-agent/effect-config"
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { CONFIG_SAMPLES } from "../domain/samples.ts"
import type { DeckDomain } from "../domain/deck.ts"
import { refuse } from "./refusal.ts"

export const overviewOperations = ({ deck, store, presets }: DeckDomain): readonly Operation[] => [
  operation({
    name: "deckconsole_deck",
    description: "The whole deck at a glance: the kinds it serves, its launchers, its open sessions, the consent asks waiting on an operator, and the per-session consent tally",
    access: "read", input: noInput,
    http: { method: "GET", path: "/api/deck" },
    handler: () => {
      const sessions = deck.sessions()
      const mapping = [...deck.consent.mapping()].map(([sessionId, list]) => ({
        sessionId, entries: list.length,
        pending: list.filter((e) => e.decision === "pending").length,
        allowed: list.filter((e) => e.decision === "allow").length,
        denied: list.filter((e) => e.decision === "deny").length,
      }))
      return {
        kinds: [...deck.kinds()], launchers: store.launchers, sessions,
        pending: deck.consent.pending(), mapping, samples: CONFIG_SAMPLES,
      }
    },
  }),
  operation({
    name: "deckconsole_config_samples",
    description: "A raw config sample per agent kind, as the text an operator starts editing from",
    access: "read", input: noInput,
    http: { method: "GET", path: "/api/config/samples" },
    handler: () => ({ ok: true, samples: CONFIG_SAMPLES }),
  }),
  operation({
    name: "deckconsole_config_preview",
    description: "Normalize a raw config for one kind, and show the command it would invoke when that kind is a CLI preset",
    access: "read", input: z.object({ kind: z.string().optional(), raw: z.string().optional() }).strict(),
    http: { method: "GET", path: "/api/config/preview" },
    handler: (input) => {
      const kind = input.kind ?? "claude-code"
      let raw: unknown = {}
      if (input.raw !== undefined) { try { raw = JSON.parse(input.raw) } catch { refuse(400, "raw must be JSON") } }
      const unified = normalizeConfig(kind as never, raw)
      return {
        ok: true, kind, unified,
        invocation: presets.invocable().includes(kind) ? cliInvocation(unified, "<prompt>", presets.all()) : null,
      }
    },
  }),
]
