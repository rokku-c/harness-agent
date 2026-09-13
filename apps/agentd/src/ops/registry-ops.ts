/**
 * The registration verbs: what an operator declares about the fleet, and what a
 * deployment is bound to. None of these contact a machine — binding is a record
 * here, and the machine learns what changed the next time it asks for its plan.
 */
import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { AgentdSurfaces } from "./surfaces.ts"

/** Any object: what an operator declares about the fleet is passed through as it arrived. */
const declared = z.looseObject({})
/** Sets are MCP sets, bundles are app artifacts: two bindings, and each names its own. */
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
    input: declared, handler: (input) => control.upsertSet(input as never) }),
  operation({ name: "agentd_bind", description: "Give an agent these MCP sets",
    input: sets, handler: (input) => control.bindAgent(input.agentId, input.setIds) }),
  operation({ name: "agentd_publish_bundle", description: "Publish a version of an app or kernel",
    input: declared, handler: (input) => control.publishBundle(input as never) }),
  operation({ name: "agentd_bind_bundles", description: "Give an agent these apps",
    input: bundles, handler: (input) => control.bindBundles(input.agentId, input.bundleIds) }),
  operation({
    // binding takes placements rather than ids, because `ns` is what distinguishes
    // two instances of one artifact
    name: "agentd_bind_node", description: "Give a node a kernel and a set of apps, each in its namespace",
    input: z.object({
      nodeId: z.string().min(1), kernelId: z.string().min(1).optional(),
      apps: z.array(z.record(z.string(), z.unknown())).default([]),
    }).strict(),
    handler: (input) => control.bindNode(input.nodeId, input.kernelId, input.apps as never),
  }),
]
