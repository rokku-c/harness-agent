import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const schema = z.object({
  databaseFile: z.string().min(1).default(".effect-agent/mcp-gateway.sqlite"),
  captureArgs: z.boolean().default(false),
}).strict()
export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-gateway", title: "mcp-gateway", description: "MCP Gateway identities and audit; the sets it enforces are agentd's",
  schema,
}
