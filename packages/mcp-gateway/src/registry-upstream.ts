import type { Registry } from "@effect-agent/mcp-registry"
import type { FetchLike } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpGatewayServer, McpUpstream } from "./contract.ts"
import { makeStreamableHttpUpstream, type McpHttpServer } from "./upstream-http.ts"

export interface McpTransportResolver { resolve(serverId: string): McpHttpServer | undefined | Promise<McpHttpServer | undefined> }
export interface McpRegistryHttpUpstreamOptions { readonly registry?: Registry; readonly resolver?: McpTransportResolver; readonly fetch?: FetchLike }

export const makeRegistryTransportResolver = (registry: Registry): McpTransportResolver => ({
  resolve: (serverId) => {
    const record = registry.get(serverId)
    if (!record || record.status === "offline" || record.transport.kind !== "streamable-http" || !record.transport.endpoint) return undefined
    return { serverId: record.serverId, name: record.name, era: record.era, transport: "streamable-http", endpoint: record.transport.endpoint }
  },
})

const signature = (server: McpGatewayServer): string => JSON.stringify([server.transport, server.endpoint, server.headers])
export const makeRegistryHttpUpstream = (options: McpRegistryHttpUpstreamOptions): McpUpstream & { close(): Promise<void> } => {
  const resolver = options.resolver ?? (options.registry && makeRegistryTransportResolver(options.registry))
  if (!resolver) throw new Error("registry HTTP upstream requires a resolver")
  const entries = new Map<string, { key: string; upstream: McpUpstream & { close(): Promise<void> } }>()
  const remove = async (serverId: string): Promise<void> => { const entry = entries.get(serverId); if (entry) { entries.delete(serverId); await entry.upstream.close() } }
  const current = async (serverId: string, server: McpHttpServer) => {
    const key = signature(server), old = entries.get(serverId)
    if (old?.key === key) return old.upstream
    if (old) await remove(serverId)
    const upstream = makeStreamableHttpUpstream({ servers: [server], fetch: options.fetch })
    entries.set(serverId, { key, upstream }); return upstream
  }
  return {
    async call(call) {
      const server = await resolver.resolve(call.serverId)
      if (!server) { await remove(call.serverId); return { status: 404, ok: false, detail: "MCP server unavailable", durationMs: 0 } }
      return (await current(call.serverId, server)).call(call)
    },
    async close() { for (const id of [...entries.keys()]) await remove(id) },
  }
}
