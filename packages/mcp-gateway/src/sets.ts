import type { Registry } from "@effect-agent/mcp-registry"
import type { McpGatewayServer, McpSet, McpSetBinding, McpSetQuery, McpSetRefusal, McpSetRegistry, McpSetResolution } from "./contract-sets.ts"
import { allowDenyOverlap, unknownName } from "./set-schema.ts"

export interface McpSetServerResolver { resolve(serverId: string): McpGatewayServer | undefined }
export interface McpSetRegistryOptions { readonly resolver?: McpSetServerResolver | ((serverId: string) => McpGatewayServer | undefined) }

const fail = (message: string): never => { throw new Error(message) }
const unique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) fail(`duplicate ${label}`)
}
const normalize = (resolver?: McpSetRegistryOptions["resolver"]): McpSetServerResolver | undefined =>
  typeof resolver === "function" ? { resolve: resolver } : resolver

export const makeRegistrySetResolver = (registry: Registry): McpSetServerResolver => ({
  resolve: (serverId) => {
    const record = registry.get(serverId)
    if (!record || record.status === "offline") return undefined
    return {
      serverId: record.serverId, name: record.name, era: record.era,
      transport: record.transport.kind, endpoint: record.transport.endpoint,
    }
  },
})

export function makeMcpSetRegistry(options: McpSetRegistryOptions = {}): McpSetRegistry {
  const servers = new Map<string, McpGatewayServer>(), sets = new Map<string, McpSet>(), bindings = new Map<string, readonly string[]>()
  const resolver = normalize(options.resolver)
  const registerServer = (server: McpGatewayServer): void => {
    if (servers.has(server.serverId)) fail(`duplicate server: ${server.serverId}`)
    servers.set(server.serverId, server)
  }
  const registerSet = (set: McpSet): void => {
    if (sets.has(set.setId)) fail(`duplicate set: ${set.setId}`)
    unique(set.servers, "server in set")
    if (!resolver && unknownName(set.servers, (id) => servers.has(id)) !== undefined) fail(`unknown server in set: ${set.setId}`)
    if (allowDenyOverlap(set)) fail(`allow-deny overlap in set: ${set.setId}`)
    sets.set(set.setId, { ...set, servers: [...set.servers] })
  }
  const boundOf = (agent: string | undefined): readonly string[] => (agent === undefined ? [] : bindings.get(agent) ?? [])
  const bindAgent = ({ agentId, setIds }: McpSetBinding): void => {
    if (bindings.has(agentId)) fail(`duplicate agent binding: ${agentId}`)
    unique(setIds, "set in binding")
    if (unknownName(setIds, (id) => sets.has(id)) !== undefined) fail(`unknown set in binding: ${agentId}`)
    bindings.set(agentId, [...setIds])
  }
  const serverOf = (serverId: string): McpGatewayServer | undefined => (resolver?.resolve ?? ((id: string) => servers.get(id)))(serverId)
  /** The candidates a call may go through, in order: the set it named, or the agent's own binding. */
  const candidates = (agent: string | undefined, setId: string | undefined): readonly string[] =>
    (setId === undefined ? boundOf(agent) : [setId]).filter((id) => sets.has(id) && (agent === undefined || boundOf(agent).includes(id)))
  /**
   * The server a set routes through: the one the caller named when it named
   * one, otherwise the set's first reachable server. A named server the set
   * does not hold is not routed — that is what makes an advertised tool's
   * server part of the question rather than a detail the answer ignores.
   */
  const routed = (set: McpSet, serverId: string | undefined): McpGatewayServer | undefined =>
    serverId === undefined
      ? set.servers.map(serverOf).find((server) => server !== undefined)
      : (set.servers.includes(serverId) ? serverOf(serverId) : undefined)
  /** The FIRST candidate that reaches a server. The ones behind it are never consulted. */
  const reaching = (query: McpSetQuery): { readonly set: McpSet; readonly server: McpGatewayServer } | undefined => {
    for (const id of candidates(query.agent, query.setId)) {
      const set = sets.get(id)
      if (set === undefined) continue
      const server = routed(set, query.serverId)
      if (server !== undefined) return { set, server }
    }
    return undefined
  }
  /** Which of a set's two lists refuses a tool. A list's absence is not a refusal. */
  const refusedBy = (set: McpSet, tool: string): McpSetRefusal | undefined =>
    set.denyTools?.includes(tool) === true ? "deny" : set.allowTools !== undefined && !set.allowTools.includes(tool) ? "allowlist" : undefined
  /**
   * The one question about a call: which set and server it goes through, and
   * whether that set's lists admit the tool. A query with no tool asks the same
   * walk and nothing can refuse it, so one function answers both the door and
   * the advertisement that door shows.
   */
  const resolve = (query: McpSetQuery): McpSetResolution | undefined => {
    const found = reaching(query)
    if (found === undefined) return undefined
    const refusal = query.tool === undefined ? undefined : refusedBy(found.set, query.tool)
    return { ...found.server, setId: found.set.setId, allowed: refusal === undefined, ...(refusal === undefined ? {} : { refusedBy: refusal }) }
  }
  return { registerServer, registerSet, bindAgent, bound: (agent) => boundOf(agent).length > 0, resolve }
}
