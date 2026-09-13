/**
 * The gateway's console plane, declared once.
 *
 * An operator comes here to ask whether one agent may reach one tool and then
 * reads the topology to understand the answer, so both are operations like any
 * other: the console reads them over HTTP and an agent calls the same
 * declarations as tools, and neither can answer differently from the other.
 *
 * What the gateway *serves* (`POST /mcp-gateway`) is the protocol itself rather
 * than a move an operator makes, so it keeps its own route and is not here.
 */
import { OperationFault, noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { Registry } from "@effect-agent/mcp-registry"
import { previewAccess, type AccessConfig, type AuditLog } from "./access-audit.ts"

/** What these operations read: the shared registry, the live config, the audit. */
export interface GatewaySurfaces {
  readonly config: AccessConfig
  readonly registry: Registry
  readonly audit: AuditLog
}

/**
 * An empty box is an unanswered question, not the empty string: the console
 * binds the tool field to a path that starts blank, and a preview run against
 * `""` would report a denial of a tool nobody named.
 */
const named = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === "" ? undefined : trimmed
}

export const mcpGatewayOperations = (surfaces: GatewaySurfaces): readonly Operation[] => [
  operation({
    name: "mcp_gateway_topology",
    description: "The gateway's registry servers, the sets that group them, the agents bound to those sets, and its recent decisions",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-gateway" },
    handler: () => ({
      app: "mcp-gateway",
      servers: surfaces.registry.list(),
      sets: surfaces.config.sets,
      bindings: surfaces.config.bindings,
      audit: surfaces.audit.list(),
    }),
  }),
  operation({
    name: "mcp_gateway_audit",
    description: "The gateway's decision log, newest first: each call it carried and what it decided about it",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-gateway/audit" },
    handler: () => ({ ok: true, events: surfaces.audit.list() }),
  }),
  operation({
    name: "mcp_gateway_access",
    description: "Whether one agent may reach one tool, and which set, allow-list or deny-list decided it; asked without a tool, whether that agent is bound to any live set at all",
    access: "read",
    input: z.object({ agent: z.string().optional(), tool: z.string().optional() }).strict(),
    http: { method: "GET", path: "/mcp-gateway/access" },
    handler: (input) => {
      const agent = named(input.agent)
      if (agent === undefined) throw new OperationFault(400, "agent query parameter is required")
      return { ok: true, access: previewAccess(surfaces.config, surfaces.registry, agent, named(input.tool)) }
    },
  }),
]
