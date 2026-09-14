import { makeRegistry, type Registry as McpRegistry } from "@effect-agent/mcp-registry"
import { makeMcpSetSlot, type McpSetSlot } from "@effect-agent/mcp-gateway"
import { makePluginHost, type EffectPluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry, type EffectRegistry } from "@effect-agent/effect-interface"
import { makeConfigRegistry, makeSqliteConfigStore, type ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { EgressRouter } from "@effect-agent/effect-network"
import { discoverManifests } from "../yaml-manifest.ts"
import { configFileFrom } from "../config-runtime/config-file.ts"
import { makeConfigRuntime } from "../config-runtime/runtime.ts"
import type { ConfigRuntime } from "../config-runtime/types.ts"
import { networkConfig } from "../network/config.ts"
import { makeManagedListeners } from "../network/listeners.ts"
import { makeNetworkRuntime } from "../network/runtime.ts"
import type { EffectServerOptions } from "./options.ts"
import type { ReloadOutcome } from "./reload-types.ts"

export interface BootServices {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly mcpRegistry: McpRegistry
  readonly mcpSets: McpSetSlot
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  readonly initializeConfig: (appId: string) => void
  readonly uiViews: Map<string, EffectUiView>
  readonly network: EgressRouter
  readonly listeners: ReturnType<typeof makeManagedListeners>
  readonly yaml: ReadonlyMap<string, unknown>
  readonly close: () => Promise<void>
}

export const makeServices = (
  roots: readonly string[],
  options: EffectServerOptions,
  reload: (appId: string) => Promise<ReloadOutcome>,
): BootServices => {
  const host = makePluginHost({ control: options.control, reload })
  const registry = makeEffectRegistry()
  const mcpRegistry = makeRegistry()
  const mcpSets = makeMcpSetSlot()
  const configFile = configFileFrom(options.configFile)
  const store = makeSqliteConfigStore({ file: configFile })
  const configs = makeConfigRegistry({ store })
  configs.register(networkConfig)

  let networkRuntime: ReturnType<typeof makeNetworkRuntime>
  let listeners: ReturnType<typeof makeManagedListeners>
  const failedReloads = new Set<string>()
  const configRuntime = makeConfigRuntime(configs, async (id) => {
    if (id === networkConfig.appId) { networkRuntime.reload(); await listeners.reload(); return }
    if (!host.list().some((p) => p.id === id)) return
    const wasEnabled = host.isEnabled(id)
    if (!wasEnabled && !failedReloads.has(id)) return
    if (wasEnabled) await host.disable(id)
    if (!await host.enable(id)) {
      failedReloads.add(id)
      throw new Error(`Plugin ${id} could not activate saved configuration`)
    }
    failedReloads.delete(id)
  }, { storeFile: configFile })
  configRuntime.initialize(networkConfig.appId, { yaml: options.network })
  networkRuntime = makeNetworkRuntime(() => configRuntime.active(networkConfig.appId))
  listeners = makeManagedListeners(host, () => configRuntime.active(networkConfig.appId))

  const uiViews = new Map<string, EffectUiView>()
  const yaml = new Map(discoverManifests(roots).map((d) => [d.manifest.id, d.manifest.config]))
  return {
    host, registry, mcpRegistry, mcpSets, configs, configRuntime, uiViews, yaml,
    network: networkRuntime.network,
    listeners,
    initializeConfig: (id) => configRuntime.initialize(id, { yaml: yaml.get(id) }),
    close: async () => { await host.close(); store.close() },
  }
}
