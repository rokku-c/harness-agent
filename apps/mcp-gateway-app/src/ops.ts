/**
 * The gateway's console plane, declared once.
 *
 * An operator comes here to ask whether one agent may reach one tool and then
 * reads the topology to understand the answer, so both are operations like any
 * other: the console reads them over HTTP and an agent calls the same
 * declarations as tools, and neither can answer differently from the other.
 *
 * The topology is read *through* the catalog rebuild rather than beside it. What
 * the gateway is made of and what it can actually offer are different facts — a
 * registered server whose tools never listed is a server nothing can be reached
 * through — and the second is only true if the surface was asked. Asking here is
 * the same call `tools/list` makes, and it is cheap when the live servers have
 * not changed, so the console's topology is the door's own answer rather than a
 * second opinion about it.
 *
 * What the gateway *serves* (`POST /mcp-gateway`) is the protocol itself rather
 * than a move an operator makes, so it keeps its own route and is not here.
 */
import { OperationFault, noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { previewAccess, type AccessSurfaces } from "./access-preview.ts"
import type { AuditLog } from "./audit-log.ts"
import type { LiveCatalog } from "./live-catalog.ts"
import type { IdentitySurfaces } from "./identity-input.ts"
import { directoryOperations } from "./ops-directory.ts"
import { tokenOperations } from "./ops-token.ts"

/** What these operations read: the shared registry, the live config, the audit — and the two engines that decide and issue. */
export interface GatewaySurfaces extends AccessSurfaces {
  readonly audit: AuditLog
  readonly catalog: LiveCatalog
  readonly identities: IdentitySurfaces
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
    description: "The gateway's registry servers, the sets that group them, the agents bound to those sets, its recent decisions, and which servers it could list tools from",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-gateway" },
    handler: async () => {
      await surfaces.catalog.refresh()
      return {
        app: "mcp-gateway",
        servers: surfaces.registry.list(),
        sets: surfaces.config.sets,
        bindings: surfaces.config.bindings,
        catalog: surfaces.catalog.report(),
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
    description: "Whether one agent may reach one tool, and which set, allow-list or deny-list decided it; asked without a tool, whether that agent is bound to any live set at all",
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
