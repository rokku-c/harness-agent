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
