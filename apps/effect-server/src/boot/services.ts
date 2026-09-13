/**
 * The host's long-lived services (docs/architecture-rework.md §6.1).
 *
 * §6.1 splits the running system in two: host invariants, and the kernel. This is
 * the host half — plugin host, registries, config store and runtime, egress router
 * and its listeners. The catalog is a live view over services that outlive every
 * kernel (§4), so it is built from these and handed to each revision rather than
 * owned by one.
 *
 * The reload callback arrives already built (reload-dispatch.ts): the host needs it
 * at construction, so it cannot be something this file creates.
 */

import { makeRegistry, type Registry as McpRegistry } from "@effect-agent/mcp-registry"
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
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  /** Give an app its config layers — what its manifest declared. */
  readonly initializeConfig: (appId: string) => void
  readonly uiViews: Map<string, EffectUiView>
  readonly network: EgressRouter
  readonly listeners: ReturnType<typeof makeManagedListeners>
  /** Each app's declared config, read once at boot. */
  readonly yaml: ReadonlyMap<string, unknown>
  /** Close what this file opened. The caller owns *when*; the order is this file's. */
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
  const configFile = configFileFrom(options.configFile)
  const store = makeSqliteConfigStore({ file: configFile })
  const configs = makeConfigRegistry({ store })
  configs.register(networkConfig)

  // Saving a listener set rebinds the ports, and rebinding rereads the config, so
  // the two reference each other. Neither exists when the other's callback is
  // written, which is why both are read through the binding at call time.
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
    host, registry, mcpRegistry, configs, configRuntime, uiViews, yaml,
    network: networkRuntime.network,
    listeners,
    initializeConfig: (id) => configRuntime.initialize(id, { yaml: yaml.get(id) }),
    close: async () => { await host.close(); store.close() },
  }
}
