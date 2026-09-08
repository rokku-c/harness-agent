import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const set = z.object({
  setId: z.string().min(1), name: z.string().min(1), servers: z.array(z.string().min(1)).min(1),
  allowTools: z.array(z.string().min(1)).optional(), denyTools: z.array(z.string().min(1)).optional(),
}).strict().superRefine((value, ctx) => {
  const allow = new Set(value.allowTools ?? [])
  if ((value.denyTools ?? []).some((tool) => allow.has(tool))) ctx.addIssue({ code: "custom", message: "allowTools and denyTools overlap" })
})
const binding = z.object({ agentId: z.string().min(1), setIds: z.array(z.string().min(1)).min(1) }).strict()
const schema = z.object({
  sets: z.array(set).default([]), bindings: z.array(binding).default([]),
  defaultAction: z.enum(["allow", "deny", "log"]).default("deny"), captureArgs: z.boolean().default(false),
}).strict()
export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-gateway", title: "mcp-gateway", description: "MCP Gateway sets and agent bindings", schema,
}
