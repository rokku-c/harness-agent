import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const capabilities = z.object({
  tools: z.number().int().nonnegative().optional(),
  resources: z.number().int().nonnegative().optional(),
  prompts: z.number().int().nonnegative().optional(),
  apps: z.number().int().nonnegative().optional(),
}).strict()

const serverSchema = z.object({
  serverId: z.string().min(1), name: z.string().min(1), version: z.string().min(1),
  era: z.enum(["modern", "auto", "legacy"]), endpoint: z.string().url().refine((value) => /^https?:\/\//.test(value), "must use http or https"),
  capabilities: capabilities.optional(), apps: z.array(z.string().min(1)).default([]),
}).strict()

const schema = z.object({
  heartbeatTtlMs: z.number().int().positive().default(2000),
  offlineAfterMs: z.number().int().positive().default(60000),
  servers: z.array(serverSchema).default([]),
  registrationTokens: z.record(z.string(), z.string().min(16)).default({}),
}).strict()

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-registry", title: "MCP Registry",
  description: "MCP server leases and topology", schema,
}
