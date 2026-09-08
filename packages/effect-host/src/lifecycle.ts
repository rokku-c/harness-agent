import { validateRoutes } from "./routes.ts"
import type { EffectPlugin } from "./plugin.ts"
import { loadEntry, unloadEntry, type PluginEntry } from "./entry.ts"
import { makeLifecycleQueue } from "./queue.ts"

/** The only owner of plugin state; every mutation (including close) uses the queue. */
export const makePluginLifecycle = () => {
  const entries = new Map<string, PluginEntry>()
  const queue = makeLifecycleQueue()

  const remove = async (id: string, expectedPlugin?: EffectPlugin): Promise<boolean> => {
    const entry = entries.get(id)
    if (entry === undefined || (expectedPlugin !== undefined && entry.plugin !== expectedPlugin)) return false
    entries.delete(id)
    await unloadEntry(entry)
    return true
  }

  return {
    list: () => [...entries].map(([id, entry]) => ({ id, enabled: entry.enabled, priority: entry.priority })),
    ordered: () => [...entries.values()].sort((a, b) => a.priority - b.priority),
    isEnabled: (id: string) => entries.get(id)?.enabled ?? false,
    register: (plugin: EffectPlugin): Promise<void> => queue.run(plugin.id, async () => {
      validateRoutes(plugin.routes ?? [])
      const existing = entries.get(plugin.id)
      if (existing !== undefined) await unloadEntry(existing)
      const entry: PluginEntry = { plugin, priority: plugin.priority ?? 100, enabled: plugin.enabled !== false }
      entries.set(plugin.id, entry)
      if (entry.enabled) await loadEntry(entry)
    }),
    unregister: (id: string, expectedPlugin?: EffectPlugin) => queue.run(id, () => remove(id, expectedPlugin)),
    enable: (id: string): Promise<boolean> => queue.run(id, async () => {
      const entry = entries.get(id)
      if (entry === undefined || entry.enabled) return false
      entry.enabled = true
      try {
        await loadEntry(entry)
      } catch (error) {
        // Preserve control API's existing failed-enable result and disabled state.
        console.error(`[effect-host] plugin ${id} load failed, staying disabled:`, error)
        return false
      }
      return true
    }),
    disable: (id: string): Promise<boolean> => queue.run(id, async () => {
      const entry = entries.get(id)
      if (entry === undefined || !entry.enabled) return false
      await unloadEntry(entry)
      return true
    }),
    close: () => queue.close(entries.keys(), remove),
  }
}

export type PluginLifecycle = ReturnType<typeof makePluginLifecycle>
