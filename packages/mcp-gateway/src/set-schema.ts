import { z } from "@effect-agent/effect-config"

export const allowDenyOverlap = (
  set: { readonly allowTools?: readonly string[]; readonly denyTools?: readonly string[] },
): boolean => {
  const allow = new Set(set.allowTools ?? [])
  return (set.denyTools ?? []).some((tool) => allow.has(tool))
}

export const repeatedName = (names: readonly string[]): string | undefined => {
  const seen = new Set<string>()
  return names.find((name) => (seen.has(name) ? true : (seen.add(name), false)))
}

export const unknownName = (
  names: readonly string[],
  known: (name: string) => boolean,
): string | undefined => names.find((name) => !known(name))

export const mcpSetSchema = z.object({
  setId: z.string().min(1),
  name: z.string().min(1),
  servers: z.array(z.string().min(1)).min(1),
  allowTools: z.array(z.string().min(1)).optional(),
  denyTools: z.array(z.string().min(1)).optional(),
}).strict().superRefine((value, ctx) => {
  if (allowDenyOverlap(value)) ctx.addIssue({ code: "custom", message: "allowTools and denyTools overlap" })
  const twice = repeatedName(value.servers)
  if (twice !== undefined) ctx.addIssue({ code: "custom", message: `${twice} is named twice in this set` })
})

export const mcpSetBindingSchema = z.object({
  agentId: z.string().min(1),
  setIds: z.array(z.string().min(1)).min(1),
}).strict().superRefine((value, ctx) => {
  const twice = repeatedName(value.setIds)
  if (twice !== undefined) ctx.addIssue({ code: "custom", message: `${twice} is bound twice to this agent` })
})
