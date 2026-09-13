/**
 * The launchers an operator saved: a kind, a label, and the raw config to open
 * that kind with.
 *
 * A launcher is addressed by its label, and the kind beside it is what tells two
 * launchers of one label apart, so a removal reads that kind from the query -
 * the shape the console's own remove press sends. Adding a launcher already
 * saved keeps the one that is there: repeating a saved configuration is not a
 * way to change it.
 */
import { z } from "@effect-agent/effect-config"
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { refuse } from "./refusal.ts"

export const launcherOperations = ({ store }: DeckDomain): readonly Operation[] => {
  const { launchers, seed, persist } = store
  return [
    operation({
      name: "deckconsole_launchers",
      description: "The launchers saved for this deck, each one a kind, a label and the raw config it opens with",
      access: "read", input: noInput,
      http: { method: "GET", path: "/api/launchers" },
      handler: () => ({ ok: true, launchers }),
    }),
    operation({
      name: "deckconsole_add_launcher",
      description: "Save a launcher under a label, so the console can open that kind with a saved config in one press",
      input: z.object({
        kind: z.string().optional(), label: z.string().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }).strict(),
      http: { method: "POST", path: "/api/launchers" },
      handler: (input) => {
        const { kind, label } = input
        if (kind === undefined || label === undefined || kind.length === 0 || label.length === 0) refuse(400, "kind and label required")
        seed(kind, label, input.config)
        persist()
        return { ok: true, launchers }
      },
    }),
    operation({
      name: "deckconsole_remove_launcher",
      description: "Forget a saved launcher by its label, narrowing to one kind when two launchers share that label",
      input: z.object({ label: z.string().min(1), kind: z.string().optional() }).strict(),
      http: { method: "DELETE", path: "/api/launchers/:label" },
      handler: (input) => {
        const at = launchers.findIndex((l) => l.label === input.label && (input.kind === undefined || l.kind === input.kind))
        if (at === -1) refuse(404, "launcher not found")
        const removed = launchers.splice(at, 1)[0]!
        persist()
        return { ok: true, removed }
      },
    }),
  ]
}
