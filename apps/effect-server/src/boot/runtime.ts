import { makeRegistry } from "@effect-agent/mcp-registry"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeConfigRegistry, makeSqliteConfigStore } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import { discoverManifests } from "../yaml-manifest.ts"
import { bootManifests } from "../load-manifest.ts"
import { makeConfigRuntime } from "../config-runtime/runtime.ts"
import { registerInfra } from "./infra.ts"
import { disposeAll } from "./dispose.ts"
import { networkConfig } from "../network/config.ts"
import { makeNetworkRuntime } from "../network/runtime.ts"
import { makeManagedListeners } from "../network/listeners.ts"
import { networkPlugin } from "../network/plugin.ts"
import type { EffectServer, EffectServerOptions } from "./options.ts"

export const bootRuntime = async (
  roots: readonly string[], enabled: ReadonlySet<string>, options: EffectServerOptions,
): Promise<EffectServer> => {
  const active = new Set(enabled)
  if (active.has("mcp-gateway")) active.add("mcp-registry")
  const host = makePluginHost({ control: options.control })
  const registry = makeEffectRegistry()
  const mcpRegistry = makeRegistry()
  const store = makeSqliteConfigStore({ file: options.configFile ?? process.env.EFFECT_CONFIG_FILE })
  const configs = makeConfigRegistry({ store })
  let cleanup = async () => { await host.close(); store.close() }
  try {
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
  })
  configRuntime.initialize(networkConfig.appId, { yaml: options.network })
  networkRuntime = makeNetworkRuntime(() => configRuntime.active(networkConfig.appId))
  const network = networkRuntime.network
  listeners = makeManagedListeners(host, () => configRuntime.active(networkConfig.appId))
  const uiViews = new Map<string, EffectUiView>(), uiHtml = new Map<string, string>()
  const yaml = new Map(discoverManifests(roots).map((d) => [d.manifest.id, d.manifest.config]))
  const initializeConfig = (id: string) => configRuntime.initialize(id, { yaml: yaml.get(id) })
  let disposers: Array<() => Promise<void>> = [], closed = false
  const app: EffectServer = {
    host, registry, mcpRegistry, configs, configRuntime, initializeConfig, uiViews, uiHtml, network,
    listen: listeners.listen, listeners: listeners.list,
    stop: async () => {
      if (closed) return
      closed = true
      await disposeAll([listeners.close, ...[...disposers].reverse(), () => host.close(), () => store.close()])
    },
  }
    cleanup = app.stop
    await host.register(networkPlugin(host, network))
    disposers = await bootManifests({ host, registry, mcpRegistry, configs, uiViews, uiHtml, network,
      initializeConfig,
      activeConfig: (id) => configRuntime.active(id),
    }, roots, active)
    await registerInfra(app, active, options)
    return app
  } catch (error) { await cleanup(); throw error }
}
