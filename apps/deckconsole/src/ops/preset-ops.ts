/**
 * The CLI presets this deck can invoke, and the ones an operator registers.
 *
 * A preset is keyed by kind, so a kind the deck already answers with - a CLI
 * built-in, or one of the kinds its own gateways serve - cannot be redefined: a
 * second meaning for one name would be a preset nothing could ever reach.
 */
import { z } from "@effect-agent/effect-config"
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { refuse } from "./refusal.ts"

/** The kinds the deck itself serves, which no preset may take over. */
const served = ["custom", "demo", "effect", "claude-cc", "effect-ops"]

export const presetOperations = ({ presets }: DeckDomain): readonly Operation[] => {
  const { builtin, dynamic } = presets
  return [
    operation({
      name: "deckconsole_presets",
      description: "The CLI presets this deck can invoke: the built-in ones, and the ones an operator registered",
      access: "read", input: noInput,
      http: { method: "GET", path: "/api/presets" },
      handler: () => ({ ok: true, presets: [
        ...Object.entries(builtin).map(([kind, preset]) => ({ kind, file: preset.file, builtin: true })),
        ...[...dynamic.entries()].map(([kind, preset]) => ({ kind, file: preset.file, args: [...preset.args], builtin: false })),
      ] }),
    }),
    operation({
      name: "deckconsole_add_preset",
      description: "Register a CLI preset under a kind, as the command to run and the arguments it always takes",
      input: z.object({
        kind: z.string().optional(), file: z.string().optional(),
        args: z.array(z.string()).optional(),
      }).strict(),
      http: { method: "POST", path: "/api/presets" },
      handler: (input) => {
        const { kind, file } = input
        if (kind === undefined || file === undefined || kind.length === 0) refuse(400, "kind and file required")
        if (builtin[kind] !== undefined || served.includes(kind)) refuse(409, "kind already taken: " + kind)
        const args = input.args ?? []
        dynamic.set(kind, { file, args })
        return { ok: true, kind, file, args }
      },
    }),
  ]
}
