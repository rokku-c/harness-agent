import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { EffectTool } from "@effect-agent/effect-interface"
import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"

/** Instance interfaces live exactly as long as the loaded app, including reloads. */
export const withAppRuntime = (host: EffectAppHost, app: EffectAppDescriptor, plugin: EffectPlugin): EffectPlugin => ({
  ...plugin, id: app.id, routes: app.routes ?? plugin.routes ?? (app.path ? [{ path: app.path, match: "prefix" }] : undefined),
  load: async (): Promise<LoadedPlane> => {
    const loaded = await plugin.load()
    let dispose: (() => void) | undefined
    try {
      if (loaded.tools) dispose = host.registry?.registerInterface({
        id: app.id, title: app.title ?? app.id, tools: loaded.tools as readonly EffectTool[],
        apps: app.path ? [{ id: "console", title: app.title ?? app.id, path: app.path, resourceUri: `ui://${app.id}/console` }] : [],
      })
    } catch (error) { await loaded.stop?.(); throw error }
    return { ...loaded, stop: async () => { try { dispose?.() } finally { await loaded.stop?.() } } }
  },
})
