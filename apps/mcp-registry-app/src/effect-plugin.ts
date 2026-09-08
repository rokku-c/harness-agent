import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import { makeRegistryHandler, makeRegistryAuth, type Registry } from "@effect-agent/mcp-registry"
import { effectConfig } from "./effect-config.ts"
import { registerServers, revokeServers, toMcpServer } from "./servers.ts"

type RegistryConfig = ReturnType<typeof effectConfig.schema.parse>

export const createMcpRegistryPlugin = (getConfig: () => unknown, registry: Registry): EffectPlugin => ({
  id: "mcp-registry", priority: 19,
  load: async (): Promise<LoadedPlane> => {
    const config: RegistryConfig = effectConfig.schema.parse(getConfig())
    const restoreConfig = registry.configure({ heartbeatTtlMs: config.heartbeatTtlMs, offlineAfterMs: config.offlineAfterMs, auth: makeRegistryAuth(config.registrationTokens) })
    const declared = config.servers.map(toMcpServer)
    const ownerId = `mcp-registry:${crypto.randomUUID()}`
    registerServers(registry, declared, ownerId)
    const handler = makeRegistryHandler(registry)
    return {
      handle: async (request) => new URL(request.url).pathname === "/mcp-registry"
        ? Response.json({ app: "mcp-registry", servers: registry.list() })
        : handler(request),
      stop: () => { revokeServers(registry, declared, ownerId); restoreConfig() },
    }
  },
})
