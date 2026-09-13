import { z } from "@effect-agent/effect-config"

/**
 * One machine, two strictnesses, and the difference is not cosmetic.
 *
 * In a config file the fields are deliberate and a default is a convenience —
 * an operator who omits `capabilities` means "none". A node announcing itself
 * (§8.5-1) is the opposite case: its `capabilities` is what the push side
 * adjudicates against, so defaulting a missing one to `[]` would be a *silent
 * wipe* of everything the node can run, and the next plan would refuse every
 * artifact with no hint as to why. So the probe's shape has no defaults: say
 * what you are, or be refused. It also has no `reportedAt` — that is when the
 * *server* last heard from the node (`DeclaredMachine`), and a node filling in
 * its own would be a claim sitting where an observation belongs.
 */
const declaredMachine = z.object({
  machineId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["online", "offline", "degraded"]),
  capabilities: z.array(z.string().min(1)),
  /** Isolation domains this node carries (§8.3). An allowlist, so the only safe default is empty. */
  namespaces: z.array(z.string().min(1)),
  /**
   * App-count ceiling (§8.3, §11-Q17). Optional in *both* shapes, deliberately:
   * a platform that answered Q17 by requiring every node to name a number would
   * have invented one and attributed it to the operator. Stating none is a fact
   * about the node, and `0` is a different one — a node that takes no apps.
   */
  maxApps: z.number().int().nonnegative().optional(),
})
/**
 * The declaration as a config file writes it: defaults allowed, unknown keys not.
 * `namespaces` defaults to empty — *carries nothing* — because an empty allowlist
 * refuses by name, while a permissive default would carry everything for exactly
 * the nodes nobody thought about.
 */
export const machine = z.object({
  ...declaredMachine.shape,
  status: declaredMachine.shape.status.default("online"),
  capabilities: declaredMachine.shape.capabilities.default([]),
  namespaces: declaredMachine.shape.namespaces.default([]),
  reportedAt: z.number().int().nonnegative().default(0),
}).strict()
/** What a node sends when it announces itself — the same shape with nothing filled in. */
export const announcedMachine = declaredMachine.strict()
