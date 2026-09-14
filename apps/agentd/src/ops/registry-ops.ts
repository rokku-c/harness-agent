import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { mcpSetSchema } from "@effect-agent/mcp-gateway"
import type { AgentdSurfaces } from "./surfaces.ts"

const declared = z.looseObject({})
const sets = z.object({ agentId: z.string().min(1), setIds: z.array(z.string()) }).strict()
const bundles = z.object({ agentId: z.string().min(1), bundleIds: z.array(z.string()) }).strict()

export const registryOperations = ({ control }: AgentdSurfaces): readonly Operation[] => [
  operation({ name: "agentd_register_machine", description: "Declare a machine the fleet knows about",
    input: declared, handler: (input) => control.registerMachine(input as never) }),
  operation({ name: "agentd_register_agent", description: "Declare an agent",
    input: declared, handler: (input) => control.registerAgent(input as never) }),
  operation({ name: "agentd_register_mcp_server", description: "Declare an MCP server agents can be given",
    input: declared, handler: (input) => control.registerServer(input as never) }),
  operation({ name: "agentd_upsert_mcpset", description: "Declare a named set of MCP servers",
    input: mcpSetSchema, handler: (input) => control.upsertSet(input) }),
  operation({ name: "agentd_bind", description: "Give an agent these MCP sets",
    input: sets, handler: (input) => control.bindAgent(input.agentId, input.setIds) }),
  operation({
    name: "agentd_credential",
    description: "The credential one agent presents at the MCP Gateway's door; issue it for the identity the agent is named by",
    input: z.object({ agentId: z.string().min(1), token: z.string().min(1) }).strict(),
    http: { method: "POST", path: "/agentd/credential" },
    handler: (input) => ({ ok: true, ...control.setCredential(input.agentId, input.token) }),
  }),
  operation({ name: "agentd_publish_bundle", description: "Publish a version of an app or kernel",
    input: declared, handler: (input) => control.publishBundle(input as never) }),
  operation({ name: "agentd_bind_bundles", description: "Give an agent these apps",
    input: bundles, handler: (input) => control.bindBundles(input.agentId, input.bundleIds) }),
  operation({
    name: "agentd_bind_node", description: "Give a node a kernel and a set of apps, each in its namespace",
    input: z.object({
      nodeId: z.string().min(1), kernelId: z.string().min(1).optional(),
      apps: z.array(z.record(z.string(), z.unknown())).default([]),
    }).strict(),
    handler: (input) => control.bindNode(input.nodeId, input.kernelId, input.apps as never),
  }),
]
