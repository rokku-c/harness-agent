/**
 * The mcpset grammar — one declaration, two authors.
 *
 * A set is declared twice over in this repo: once in the gateway's config, which
 * an operator writes, and once in agentd's, which is what a machine is told to
 * connect through. Those were two zod objects with the same fields and different
 * rules — one demanded at least one server, the other accepted none — so the
 * same config meant two things depending on who read it. A grammar written twice
 * is two grammars, so it is written once, here, next to the `McpSet` it compiles
 * to (`contract.ts`).
 *
 * `allowDeny` is the part a field shape cannot carry: a set that both allows and
 * denies one tool has no meaning, and the gateway's runtime registry rejected it
 * while the config accepted it. Both now ask the same question.
 */

import { z } from "@effect-agent/effect-config"

/** A set that both allows and denies one tool has no meaning. The one rule about sets. */
export const allowDenyOverlap = (
  set: { readonly allowTools?: readonly string[]; readonly denyTools?: readonly string[] },
): boolean => {
  const allow = new Set(set.allowTools ?? [])
  return (set.denyTools ?? []).some((tool) => allow.has(tool))
}

/**
 * The first name that is not one of the known ones, or undefined: a set bound
 * to an agent, or a server named by a set. A name nobody declares authorizes
 * nothing, so it is refused rather than carried — the grammar refuses it while
 * the operator is looking at the form, and the registry refuses it when a
 * caller registers directly. One rule, asked by both doors, because a binding
 * that means "refused here, carried there" is how a preview ends up explaining
 * a decision the gateway never made.
 */
export const unknownName = (
  names: readonly string[],
  known: (name: string) => boolean,
): string | undefined => names.find((name) => !known(name))

/** A declared set. At least one server: a set that reaches nothing is not a set. */
export const mcpSetSchema = z.object({
  setId: z.string().min(1),
  name: z.string().min(1),
  servers: z.array(z.string().min(1)).min(1),
  allowTools: z.array(z.string().min(1)).optional(),
  denyTools: z.array(z.string().min(1)).optional(),
}).strict().superRefine((value, ctx) => {
  if (allowDenyOverlap(value)) ctx.addIssue({ code: "custom", message: "allowTools and denyTools overlap" })
})

/** An agent's sets. At least one: a binding to nothing says nothing. */
export const mcpSetBindingSchema = z.object({
  agentId: z.string().min(1),
  setIds: z.array(z.string().min(1)).min(1),
}).strict()
