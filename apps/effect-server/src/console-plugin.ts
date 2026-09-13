import { existsSync, readFileSync } from "node:fs"
import type { EffectPlugin } from "@effect-agent/effect-host"
import { makeClientBundle } from "./client-bundle.ts"
import { consolePage } from "./console-page.ts"
import { makeConfigRuntime } from "./config-runtime/runtime.ts"
import { appsCatalogue } from "./console/apps-catalogue.ts"
import { configRoute } from "./console/config-route.ts"
import { callRoute } from "./console/tools-route.ts"
import { viewRoute } from "./console/view-route.ts"
import type { ConsoleOptions } from "./console/options.ts"
export type { ConsoleOptions } from "./console/options.ts"

/**
 * The client bundle and the stylesheet it extracts. Both come out of one
 * `bun run build:client`, and both are served from disk: the console renders
 * nothing it did not ship as a file, so a browser cache and the source agree.
 *
 * While `dev` is on they are built from source instead — see client-bundle.ts for
 * why, and for the one thing that cannot be left to a cache.
 */
const CLIENT_ASSETS: Readonly<Record<string, { readonly file: string; readonly type: string }>> = {
  "/console-client.js": { file: "../public/effect-ui-client.js", type: "text/javascript; charset=utf-8" },
  "/console-client.css": { file: "../public/effect-ui-client.css", type: "text/css; charset=utf-8" },
}

const fromDisk = (path: string): Response | undefined => {
  const entry = CLIENT_ASSETS[path]
  if (entry === undefined) return undefined
  const file = new URL(entry.file, import.meta.url)
  return existsSync(file) ? new Response(readFileSync(file), { headers: { "content-type": entry.type } }) : new Response(null, { status: 404 })
}

export const makeConsolePlugin = (options: ConsoleOptions): EffectPlugin => ({
  id: "console", priority: 90,
  load: async () => {
    const runtime = options.configRuntime ?? makeConfigRuntime(options.configs)
    const bundle = options.dev === true ? makeClientBundle() : undefined
    const clientAsset = async (path: string): Promise<Response | undefined> =>
      bundle === undefined ? fromDisk(path) : bundle.serve(path) ?? fromDisk(path)
    const initialize = (id: string) => runtime.initialize(id, { yaml: options.yamlOf?.(id) })
    for (const c of options.configs.list()) initialize(c.appId)
    return {
      canHandle: (path) => path === "/console" || path.startsWith("/console/") || path in CLIENT_ASSETS || path === "/-/apps",
      handle: async (request) => {
        const path = new URL(request.url).pathname
        const served = await clientAsset(path)
        if (served !== undefined) return served
        if (path === "/-/apps") return Response.json(appsCatalogue(options))
        const config = path.match(/^\/console\/api\/config\/([^/]+)(\/apply)?$/)
        if (config) {
          const id = decodeURIComponent(config[1])
          if (options.configs.get(id)) initialize(id)
          return configRoute(request, id, options.configs, runtime, !!config[2])
        }
        const view = path.match(/^\/console\/api\/view\/([^/]+)$/)
        if (view) return viewRoute(options, decodeURIComponent(view[1]))
        const call = path.match(/^\/console\/api\/tools\/([^/]+)\/([^/]+)$/)
        if (call) return callRoute(options.registry, decodeURIComponent(call[1]), decodeURIComponent(call[2]), request)
        if (path === "/console" || path === "/console/") return new Response(consolePage, { headers: { "content-type": "text/html; charset=utf-8" } })
        return Response.json({ ok: false, detail: "Not found" }, { status: 404 })
      },
    }
  },
})
