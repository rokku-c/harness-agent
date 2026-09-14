import type { EffectPlugin } from "@effect-agent/effect-host"
import type { AppsCatalogOptions } from "../apps-catalog.ts"
import { makeAppsPlane } from "../apps-plane.ts"
import { makeConfigPlugin } from "../config-plugin.ts"
import { makeConsolePlugin } from "../console-plugin.ts"
import { makeMonitorPlane } from "../monitor-plane.ts"
import { networkPlugin } from "../network/plugin.ts"
import type { KernelContext } from "./types.ts"

const catalogOptions = (context: KernelContext): AppsCatalogOptions => ({
  registry: context.registry,
  configs: context.configs,
  uiViews: context.uiViews,
})

export const pluginFor = (planeId: string, context: KernelContext): EffectPlugin => {
  switch (planeId) {
    case "platform-network":
      return networkPlugin(context.host, context.network)
    case "monitor":
      return makeMonitorPlane({ ...catalogOptions(context), catalog: context.catalog, observationFile: context.observationFile })
    case "effect-apps":
      return makeAppsPlane({ ...catalogOptions(context), catalog: context.catalog, reload: context.host.reload })
    case "console":
      return makeConsolePlugin({
        registry: context.registry, configs: context.configs, configRuntime: context.configRuntime,
        uiViews: context.uiViews, dev: context.dev,
      })
    case "config":
      return makeConfigPlugin(context.configs, context.yamlOf)
    default:
      throw new Error(`effect-server: no kernel plane implements ${planeId}`)
  }
}
