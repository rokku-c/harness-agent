import type { EffectPlugin, EffectPluginHost } from "@effect-agent/effect-host"
import { asyncDisposer, rollback, type AsyncAppDisposer } from "./disposal.ts"

/** Each registration owns a distinct identity, even when descriptors reuse a plugin. */
export const registerAppPlugin = async (host: EffectPluginHost, plugin: EffectPlugin): Promise<AsyncAppDisposer> => {
  const registered: EffectPlugin = {
    id: plugin.id,
    priority: plugin.priority,
    enabled: plugin.enabled,
    routes: plugin.routes,
    load: () => plugin.load(),
  }
  const remove = async (): Promise<void> => { await host.unregister(registered.id, registered) }
  try { await host.register(registered) } catch (error) { return rollback(error, remove) }
  return asyncDisposer([remove])
}
