import { makeMcpPlugin } from "../mcp-plugin.ts"
import { makeConfigPlugin } from "../config-plugin.ts"
import { makeConsolePlugin } from "../console-plugin.ts"
import { makeAppsPlane } from "../apps-plane.ts"
import { makeMonitorPlane } from "../monitor-plane.ts"
import { makeLiveAppCatalog } from "../apps-catalog.ts"
import type { EffectServer, EffectServerOptions } from "./options.ts"

export const registerInfra = async (
  app: EffectServer, enabled: ReadonlySet<string>, options: EffectServerOptions,
): Promise<void> => {
  const { host, registry, configs, configRuntime, uiViews, uiHtml } = app
  if (enabled.has("mcp")) await host.register(makeMcpPlugin({ servers: options.mcpServers ?? [] }))
  if (enabled.has("config")) await host.register(makeConfigPlugin(configs))
  if (enabled.has("console")) await host.register(makeConsolePlugin({ registry, configs, configRuntime, uiViews, uiHtml }))
  const shared = {
    registry, configs, uiViews,
    // Local single-operator host. Config credentials are never in the agent plane.
    authorize: (_id: string, plane: string) => plane !== "config",
    stateReader: async (id: string) => {
      if (id !== "board") return undefined
      const res = await host.handle(new Request("http://effect/board/api/state"))
      return res.ok ? await res.json() : undefined
    },
  }
  const catalog = makeLiveAppCatalog(shared)
  if (enabled.has("effect-apps")) await host.register(makeAppsPlane({ ...shared, catalog }))
  if (enabled.has("monitor")) await host.register(makeMonitorPlane({ ...shared, catalog, uiHtml,
    observationFile: process.env.EFFECT_OBSERVE_FILE,
  }))
}
