/**
 * The shipped kernel's planes: one implementation per slot in `KERNEL_PLANES`.
 *
 * These are the same factories the composition root used to call inline before the
 * split. What changed is who owns them: the kernel builds and owns its planes, and
 * the host holds only a stable stand-in per slot. A kernel revision therefore
 * supplies implementations, never the routing table.
 */

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
      // A slot with no implementation is a broken build, not a runtime condition:
      // the plane list and this switch are two halves of one declaration.
      throw new Error(`effect-server: no kernel plane implements ${planeId}`)
  }
}
