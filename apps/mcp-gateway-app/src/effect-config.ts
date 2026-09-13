import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import { mcpSetBindingSchema as binding, mcpSetSchema as set } from "@effect-agent/mcp-gateway"

const schema = z.object({
  sets: z.array(set).default([]), bindings: z.array(binding).default([]),
  defaultAction: z.enum(["allow", "deny", "log"]).default("deny"), captureArgs: z.boolean().default(false),
}).strict()
export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-gateway", title: "mcp-gateway", description: "MCP Gateway sets and agent bindings", schema,
}
