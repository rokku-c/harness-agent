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
