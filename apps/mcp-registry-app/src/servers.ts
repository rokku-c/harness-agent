import type { McpServer, Registry } from "@effect-agent/mcp-registry"

export interface RegistryServerConfig {
  readonly serverId: string
  readonly name: string
  readonly version: string
  readonly era: McpServer["era"]
  readonly endpoint: string
  readonly capabilities?: McpServer["capabilities"]
  readonly apps: readonly string[]
}

export const toMcpServer = (config: RegistryServerConfig): McpServer => ({
  serverId: config.serverId,
  name: config.name,
  version: config.version,
  era: config.era,
  transport: { kind: "streamable-http", endpoint: config.endpoint },
  ...(config.capabilities === undefined ? {} : { capabilities: config.capabilities }),
  apps: config.apps,
})

const identity = (server: McpServer): string => JSON.stringify([
  server.serverId, server.name, server.version, server.namespace, server.era,
  server.transport, server.capabilities, server.apps,
])
const same = (left: McpServer, right: McpServer): boolean => identity(left) === identity(right)

export const registerServers = (registry: Registry, servers: readonly McpServer[], ownerId: string): void => {
  for (const server of servers) registry.register(server, { ownerId })
}

export const revokeServers = (registry: Registry, servers: readonly McpServer[], ownerId: string): void => {
  for (const server of servers) {
    const current = registry.get(server.serverId)
    if (current?.ownerId === ownerId && same(current, server)) registry.unregister(server.serverId)
  }
}
