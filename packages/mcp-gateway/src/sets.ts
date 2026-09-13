import type { Registry } from "@effect-agent/mcp-registry"
import type { McpGatewayServer, McpSet, McpSetBinding, McpSetRegistry, McpSetResolution } from "./contract.ts"
import { allowDenyOverlap } from "./set-schema.ts"

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
    if (!resolver && set.servers.some((id) => !servers.has(id))) fail(`unknown server in set: ${set.setId}`)
    if (allowDenyOverlap(set)) fail(`allow-deny overlap in set: ${set.setId}`)
    sets.set(set.setId, { ...set, servers: [...set.servers] })
  }
  const bindAgent = ({ agentId, setIds }: McpSetBinding): void => {
    if (bindings.has(agentId)) fail(`duplicate agent binding: ${agentId}`)
    unique(setIds, "set in binding")
    if (setIds.some((id) => !sets.has(id))) fail(`unknown set in binding: ${agentId}`)
    bindings.set(agentId, [...setIds])
  }
  const resolve = (agent: string | undefined, setId: string | undefined, tool: string): McpSetResolution | undefined => {
    const candidates = setId ? [setId] : (agent ? bindings.get(agent) ?? [] : [])
    for (const id of candidates) {
      if (agent && !bindings.get(agent)?.includes(id)) continue
      const set = sets.get(id)
      if (!set) continue
      const allowed = (!set.allowTools || set.allowTools.includes(tool)) && !set.denyTools?.includes(tool)
      const find = resolver?.resolve ?? ((serverId: string) => servers.get(serverId))
      const server = set.servers.map(find).find(Boolean)
      if (server) return { ...server, setId: id, allowed }
    }
    return undefined
  }
  return { registerServer, registerSet, bindAgent, resolve }
}
