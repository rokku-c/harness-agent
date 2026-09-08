import { existsSync, readFileSync } from "node:fs"
import type { EffectPlugin } from "@effect-agent/effect-host"
import { consolePage } from "./console-page.ts"
import { makeConfigRuntime } from "./config-runtime/runtime.ts"
import { configRoute } from "./console/config-route.ts"
import { viewRoute } from "./console/view-route.ts"
import type { ConsoleOptions } from "./console/options.ts"
export type { ConsoleOptions } from "./console/options.ts"

export const makeConsolePlugin = (options: ConsoleOptions): EffectPlugin => ({
  id: "console", priority: 90,
  load: async () => {
    const runtime = options.configRuntime ?? makeConfigRuntime(options.configs)
    const initialize = (id: string) => runtime.initialize(id, { yaml: options.yamlOf?.(id) })
    for (const c of options.configs.list()) initialize(c.appId)
    return {
      canHandle: (path) => path === "/console" || path.startsWith("/console/") || path === "/console-client.js" || path === "/-/apps",
      handle: async (request) => {
        const path = new URL(request.url).pathname
        if (path === "/console-client.js") {
          const file = new URL("../public/effect-ui-client.js", import.meta.url)
          return existsSync(file) ? new Response(readFileSync(file), { headers: { "content-type": "text/javascript; charset=utf-8" } }) : new Response(null, { status: 404 })
        }
        if (path === "/-/apps") return Response.json({
          ui: options.registry.apps().map((a) => ({ interfaceId: a.interfaceId, ...a.app })),
          views: [...options.uiViews?.keys() ?? []],
          config: options.configs.list().map((c) => ({ appId: c.appId, title: c.title ?? c.appId, hasSchema: true })),
        })
        const config = path.match(/^\/console\/api\/config\/([^/]+)(\/apply)?$/)
        if (config) {
          const id = decodeURIComponent(config[1])
          if (options.configs.get(id)) initialize(id)
          return configRoute(request, id, options.configs, runtime, !!config[2])
        }
        const view = path.match(/^\/console\/api\/view\/([^/]+)$/)
        if (view) return viewRoute(options, decodeURIComponent(view[1]))
        if (path === "/console" || path === "/console/") return new Response(consolePage, { headers: { "content-type": "text/html; charset=utf-8" } })
        return Response.json({ ok: false, detail: "Not found" }, { status: 404 })
      },
    }
  },
})
