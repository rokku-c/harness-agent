/**
 * The registry's console surface, declared once.
 *
 * Each declaration below is served twice - as an MCP tool and as an HTTP route -
 * from this one list, so an agent and the console cannot drift into two
 * registries. What the console can send is a scalar (`UiActionParam` is a
 * string, a number, a boolean or null), so the declaration an operator pastes
 * travels as JSON text and is parsed here. The registry's own schema stays the
 * one authority for what a server declaration is, whichever surface it arrives
 * on. The routes a server announces and heartbeats over (`/-/registry/*`) are
 * the registry's protocol rather than the console's, and are not part of this
 * list.
 */
import { OperationFault, noInput, operation, toEffectTools, type EffectTool, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { announceSchema, type Registry } from "@effect-agent/mcp-registry"
import type { HttpSend } from "@effect-agent/effect-network"
import { readResourcePreview } from "./resource-preview.ts"

/** The token the registry holds for a server id; it authorizes that server's own moves. */
const token = z.string().min(1)

const refused = (): never => { throw new OperationFault(403, "unauthorized registry operation") }

/** What the console reads: the servers, and the counts the page states over them. */
const catalog = (registry: Registry): unknown => {
  const servers = registry.list()
  const count = (status: string): number => servers.filter((server) => server.status === status).length
  return { app: "mcp-registry", servers, summary: { total: servers.length, healthy: count("healthy"), warn: count("warn"), offline: count("offline") } }
}

/** A pasted declaration that is not JSON is the caller's mistake, not a failure of the registry. */
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

/** A resource that could not be read is the upstream server's fault, not this one's. */
const preview = async (registry: Registry, send: HttpSend, serverId: string, uri: string): Promise<unknown> => {
  const server = registry.get(serverId)
  if (server === undefined) throw new OperationFault(404, "server not found")
  try { return await readResourcePreview(server, uri, send) }
  catch (error) { throw new OperationFault(502, error instanceof Error ? error.message : String(error)) }
}

export const registryOperations = (registry: Registry, send: HttpSend): readonly Operation[] => [
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
    // the console sends the id and the token as a body, and a delete would be
    // read from the query by default - the two moves differ only in their verb
    http: { method: "DELETE", path: "/mcp-registry/withdraw", from: "body" },
    handler: (input) => withdraw(registry, input.serverId, input.token),
  }),
  operation({
    name: "mcp_registry_preview",
    description: "Read a ui:// resource a registered server declares, over that server's own MCP endpoint",
    access: "read", input: z.object({ serverId: z.string().min(1), uri: z.string().min(1) }).strict(),
    http: { method: "GET", path: "/-/registry/preview" },
    handler: (input) => preview(registry, send, input.serverId, input.uri),
  }),
]

/** The same list as tools: what an agent reaches over MCP. */
export const makeRegistryTools = (registry: Registry, send: HttpSend): readonly EffectTool[] =>
  toEffectTools(registryOperations(registry, send))
