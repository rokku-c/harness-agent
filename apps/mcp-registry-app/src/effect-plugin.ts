import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { toHttpHandler } from "@effect-agent/effect-interface"
import { makeRegistryHandler, makeRegistryAuth } from "@effect-agent/mcp-registry"
import { effectConfig } from "./effect-config.ts"
import { makeRegistryTools, registryOperations } from "./ops.ts"
import { registerServers, revokeServers, toMcpServer } from "./servers.ts"

type RegistryConfig = ReturnType<typeof effectConfig.schema.parse>

export const createMcpRegistryPlugin = (getConfig: () => unknown, context: AppRuntimeContext): EffectPlugin => {
  const registry = context.mcpRegistry
  if (registry === undefined) throw new Error("mcp-registry requires the shared registry")
  return { id: "mcp-registry", priority: 19,
  load: async (): Promise<LoadedPlane> => {
    const config: RegistryConfig = effectConfig.schema.parse(getConfig())
    const restoreConfig = registry.configure({ heartbeatTtlMs: config.heartbeatTtlMs, offlineAfterMs: config.offlineAfterMs, auth: makeRegistryAuth(config.registrationTokens) })
    const declared = config.servers.map(toMcpServer)
    const ownerId = `mcp-registry:${crypto.randomUUID()}`
    registerServers(registry, declared, ownerId)
    // What a server announces over is the registry's own protocol, so it stays
    // the registry's own answer; every move an operator makes is declared once
    // in the operations and served from there on both surfaces.
    const announce = makeRegistryHandler(registry)
    const operations = toHttpHandler(registryOperations(registry, context.fetch))
    return {
      tools: makeRegistryTools(registry, context.fetch),
      handle: async (request) => (await operations(request)) ?? announce(request),
      stop: () => { revokeServers(registry, declared, ownerId); restoreConfig() },
    }
  },
  }
}
