import { OperationFault, noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { previewAccess, type AccessSurfaces } from "./access-preview.ts"
import type { AuditLog } from "./audit-log.ts"
import type { LiveCatalog } from "./live-catalog.ts"
import type { IdentitySurfaces } from "./identity-input.ts"
import { directoryOperations } from "./ops-directory.ts"
import { tokenOperations } from "./ops-token.ts"
import { withListings } from "./server-listings.ts"

export interface GatewaySurfaces extends AccessSurfaces {
  readonly audit: AuditLog
  readonly live: LiveCatalog
  readonly identities: IdentitySurfaces
}

const named = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === "" ? undefined : trimmed
}

export const mcpGatewayOperations = (surfaces: GatewaySurfaces): readonly Operation[] => [
  operation({
    name: "mcp_gateway_topology",
    description: "The gateway's registry servers and what each answered when its tools were listed, the sets and agent bindings the agentd center declares, the tools it can offer, and its recent decisions",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-gateway" },
    handler: async () => {
      await surfaces.live.refresh()
      const facts = surfaces.sets.facts()
      return {
        app: "mcp-gateway",
        servers: withListings(surfaces.registry.list(), surfaces.live.report()),
        sets: facts.sets,
        bindings: facts.bindings,
        revision: facts.revision,
        tools: surfaces.offered.list(),
        audit: surfaces.audit.list(),
      }
    },
  }),
  operation({
    name: "mcp_gateway_audit",
    description: "The gateway's decision log, newest first: each call it carried and what it decided about it",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-gateway/audit" },
    handler: () => ({ ok: true, events: surfaces.audit.list() }),
  }),
  operation({
    name: "mcp_gateway_access",
    description: "Whether one identity may reach one tool, and which set, allow-list or deny-list decided it; the tool is named as tools/list answers it, and without one the question is whether that identity is bound to any live set at all",
    access: "read",
    input: z.object({ agent: z.string().optional(), tool: z.string().optional() }).strict(),
    http: { method: "GET", path: "/mcp-gateway/access" },
    handler: (input) => {
      const agent = named(input.agent)
      if (agent === undefined) throw new OperationFault(400, "agent query parameter is required")
      return { ok: true, access: previewAccess(surfaces, agent, named(input.tool)) }
    },
  }),
  ...directoryOperations(surfaces.identities),
  ...tokenOperations(surfaces.identities),
]
