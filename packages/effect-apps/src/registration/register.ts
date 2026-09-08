import type { ConfigDeclaration } from "@effect-agent/effect-config"
import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"
import { asyncDisposer, rollback, type AsyncAppDisposer, type Cleanup } from "./disposal.ts"
import { registerMetadata } from "./metadata.ts"
import { registerAppPlugin } from "./plugin.ts"
import { withAppRuntime } from "./runtime.ts"

/** Schema -> active config initialization -> metadata -> awaited plugin load. */
export const registerEffectApp = async (host: EffectAppHost, app: EffectAppDescriptor): Promise<AsyncAppDisposer> => {
  const steps: Cleanup[] = []
  const dispose = asyncDisposer(steps)
  try {
    if (host.configs !== undefined && app.config !== undefined) {
      // Distinct declarations make registry disposers safe even when descriptors are reused.
      steps.push(host.configs.register({ ...app.config as ConfigDeclaration }))
      host.initializeConfig?.(app.id)
    }
    if (host.network) steps.push(host.network.registerApp(app.id, app.egress))
    registerMetadata(host, app, steps)
    if (host.host !== undefined) {
      const getConfig = (): unknown => host.activeConfig !== undefined
        ? host.activeConfig(app.id)
        : host.configs?.read(app.id).value
      const plugin = app.createPlugin !== undefined ? app.createPlugin(getConfig, {
        fetch: (input, init) => {
          if (!host.network) return Promise.reject(new Error(`No platform egress registered for ${app.id}`))
          return host.network.fetch(app.id, input, init)
        },
        mcpRegistry: host.mcpRegistry,
      }) : app.plugin
      if (plugin !== undefined) steps.push(await registerAppPlugin(host.host, withAppRuntime(host, app, plugin)))
    }
    return dispose
  } catch (error) {
    return rollback(error, dispose)
  }
}
