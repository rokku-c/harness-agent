import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import { mcpSetBindingSchema as binding, mcpSetSchema as set } from "@effect-agent/mcp-gateway"
import { bundle } from "./bundle-schema.ts"
import { machine } from "./machine-schema.ts"

const agent = z.object({
  agentId: z.string().min(1), machineId: z.string().min(1),
  kind: z.string().min(1), version: z.string().min(1),
  status: z.enum(["online", "offline", "degraded"]).default("offline"),
}).strict()
const server = z.object({
  serverId: z.string().min(1), endpoint: z.string().min(1),
  transport: z.enum(["stdio", "streamable-http"]), authRef: z.string().min(1).optional(),
}).strict()
const bundleBinding = z.object({ agentId: z.string().min(1), bundleIds: z.array(z.string().min(1)) }).strict()
const nodeApp = z.object({
  bundleId: z.string().min(1), version: z.string().min(1),
  ns: z.string().min(1), enabled: z.boolean().optional(),
}).strict()
const nodeBinding = z.object({
  nodeId: z.string().min(1),
  kernelId: z.string().min(1).optional(),
  apps: z.array(nodeApp).default([]),
}).strict()
const credential = z.object({ agentId: z.string().min(1), token: z.string().min(1) }).strict()
const schema = z.object({
  machines: z.array(machine).default([]),
  agents: z.array(agent).default([]),
  credentials: z.array(credential).default([]),
  servers: z.array(server).default([]),
  sets: z.array(set).default([]),
  bindings: z.array(binding).default([]),
  bundles: z.array(bundle).default([]),
  bundleBindings: z.array(bundleBinding).default([]),
  nodeBindings: z.array(nodeBinding).default([]),
  nodeToken: z.string().min(1).optional(),
  tunnel: z.array(z.object({ name: z.string().min(1), url: z.string().min(1) }).strict()).default([]),
  leaseTtlMs: z.number().int().positive().optional(),
  gateway: z.string().min(1).optional(),
}).strict()

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "agentd", title: "agentd", description: "Machine and agent configuration center", schema,
}
