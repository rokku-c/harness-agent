import type { EffectPlugin, LoadedPlane } from "./plugin.ts"

export interface PluginEntry {
  readonly plugin: EffectPlugin
  readonly priority: number
  enabled: boolean
  loaded?: LoadedPlane
}

export const loadEntry = async (entry: PluginEntry): Promise<void> => {
  try {
    if (entry.loaded === undefined) entry.loaded = await entry.plugin.load()
  } catch (error) {
    entry.enabled = false
    throw error
  }
}

/** Detach before stopping: failed stops cannot remain routable or run twice. */
export const unloadEntry = async (entry: PluginEntry): Promise<void> => {
  entry.enabled = false
  const loaded = entry.loaded
  entry.loaded = undefined
  await loaded?.stop?.()
}
