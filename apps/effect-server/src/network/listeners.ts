import { makeListenerManager } from "@effect-agent/effect-network"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import { networkSchema } from "./config.ts"

/** Binding ports is explicit; constructing the app host binds no socket. */
export const makeManagedListeners = (host: EffectPluginHost, getConfig: () => unknown) => {
  let manager = makeListenerManager({ handle: (request) => host.handle(request), resolveApp: (request) => host.resolveApp(request) })
  let started = false
  const bind = async () => {
    try {
      for (const port of networkSchema.parse(getConfig()).listeners) await manager.register(port)
    } catch (error) { await manager.close(); throw error }
  }
  return {
    listen: async () => { if (!started) { await bind(); started = true }; return manager.list() },
    list: () => manager.list(),
    reload: async () => {
      if (!started) return
      await manager.close()
      manager = makeListenerManager({ handle: (request) => host.handle(request), resolveApp: (request) => host.resolveApp(request) })
      await bind()
    },
    close: async () => { started = false; await manager.close() },
  }
}
