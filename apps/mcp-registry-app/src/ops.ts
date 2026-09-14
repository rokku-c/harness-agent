import { OperationFault, noInput, operation, toEffectTools, type EffectTool, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { announceSchema, type Registry } from "@effect-agent/mcp-registry"
import type { HttpSend } from "@effect-agent/effect-network"
import { previewOperations } from "./ops-preview.ts"
import { rotateToken } from "./ops-rotate.ts"
import type { RotatedTokens } from "./rotated-tokens.ts"

const token = z.string().min(1)

const refused = (): never => { throw new OperationFault(403, "unauthorized registry operation") }

const catalog = (registry: Registry): unknown => {
  const servers = registry.list()
  const count = (status: string): number => servers.filter((server) => server.status === status).length
  return { app: "mcp-registry", servers, summary: { total: servers.length, healthy: count("healthy"), warn: count("warn"), offline: count("offline") } }
}

const parsed = (text: string): unknown => {
  try { return JSON.parse(text) } catch { throw new OperationFault(400, "declaration must be JSON") }
}

const register = (registry: Registry, declaration: string, credential: string): unknown => {
  const server = announceSchema.parse(parsed(declaration))
  try { return registry.announce(server, credential) } catch { return refused() }
}

const withdraw = (registry: Registry, serverId: string, credential: string): unknown => {
  if (registry.get(serverId) === undefined) throw new OperationFault(404, "server not found")
  return registry.withdraw(serverId, credential) ? { ok: true, serverId } : refused()
}

export const registryOperations = (registry: Registry, rotated: RotatedTokens, send: HttpSend): readonly Operation[] => [
  operation({
    name: "mcp_registry_servers",
    description: "The MCP servers the registry holds, with each one's transport, capabilities, lease, and health",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-registry" },
    handler: () => catalog(registry),
  }),
  operation({
    name: "mcp_registry_register",
    description: "Register an MCP server from its declaration as JSON text; an id the registry already holds is replaced, so the call is an upsert",
    input: z.object({ declaration: z.string().min(1), token }).strict(),
    http: { method: "POST", path: "/mcp-registry/register" },
    handler: (input) => register(registry, input.declaration, input.token),
  }),
  operation({
    name: "mcp_registry_withdraw",
    description: "Remove a server from the registry by its id; it stops being offered at once and the removal cannot be undone",
    input: z.object({ serverId: z.string().min(1), token }).strict(),
    http: { method: "DELETE", path: "/mcp-registry/withdraw", from: "body" },
    handler: (input) => withdraw(registry, input.serverId, input.token),
  }),
  operation({
    name: "mcp_registry_rotate",
    description: "Replace the token a registered server is authorized by, for a server whose token was lost; the token it presents now stops being accepted at once, so the server has to be told the new one",
    input: z.object({ serverId: z.string().min(1), newToken: token }).strict(),
    http: { method: "POST", path: "/mcp-registry/rotate" },
    handler: (input) => rotateToken(registry, rotated, input.serverId, input.newToken),
  }),
  ...previewOperations(registry, send),
]

export const makeRegistryTools = (registry: Registry, rotated: RotatedTokens, send: HttpSend): readonly EffectTool[] =>
  toEffectTools(registryOperations(registry, rotated, send))
