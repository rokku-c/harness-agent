/**
 * The machine's half of §F10: the config it should write for one of its agents.
 *
 * A machine behind NAT is the only one that can write that file, and the file
 * carries the credential, so the answer goes to a caller presenting the node
 * credential rather than being drawn on an operator's console. `agentd_artifact`
 * is the same shape for the same reason: bytes and secrets are fetched, not
 * browsed. What the console states instead is the word — whether the door will
 * name this agent at all.
 */
import { json, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { NODE_CREDENTIAL } from "./node-ops.ts"
import type { AgentdSurfaces } from "./surfaces.ts"

export const gatewayOperations = ({ control }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_gateway_config",
    description: "The MCP Gateway configuration this machine should write for one of its agents",
    access: "read", input: z.object({
      agentId: z.string().min(1), token: z.string().optional(), reported: json(z.unknown()).optional(),
    }).strict(),
    http: { method: "GET", path: "/agentd/gateway", credential: NODE_CREDENTIAL },
    handler: (input) => ({ ok: true, plan: control.gatewayConfig(input.agentId, input.token, input.reported) }),
  }),
]
