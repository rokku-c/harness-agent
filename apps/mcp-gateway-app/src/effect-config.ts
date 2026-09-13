import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import { mcpSetBindingSchema as binding, mcpSetSchema as set, unknownName } from "@effect-agent/mcp-gateway"

/**
 * The same rule the registry asks, asked while the operator is looking at the
 * form. A binding to a set nobody declares authorizes nothing, and the registry
 * refuses it by throwing — which, at load, is an app that never comes up and
 * names nothing. The grammar says it first, and names the binding.
 */
const schema = z.object({
  sets: z.array(set).default([]), bindings: z.array(binding).default([]),
  defaultAction: z.enum(["allow", "deny", "log"]).default("deny"), captureArgs: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  const declared = new Set(value.sets.map((one) => one.setId))
  for (const bind of value.bindings) {
    const unknown = unknownName(bind.setIds, (setId) => declared.has(setId))
    if (unknown !== undefined) {
      ctx.addIssue({ code: "custom", path: ["bindings"], message: `${bind.agentId} is bound to ${unknown}, which is not a configured set` })
    }
  }
})
export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-gateway", title: "mcp-gateway", description: "MCP Gateway sets and agent bindings", schema,
}
