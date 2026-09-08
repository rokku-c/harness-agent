import type { EffectPlugin } from "@effect-agent/effect-host"
import { invokeAppTool, type AppCatalog } from "@effect-agent/effect-apps"
import { createObservationStore } from "@effect-agent/effect-observe"
import { makeLiveAppCatalog, type AppsCatalogOptions } from "./apps-catalog.ts"
import { parityOf, projectView } from "./monitor/projection.ts"

export interface MonitorOptions extends AppsCatalogOptions {
  readonly catalog?: AppCatalog
  readonly uiHtml?: ReadonlyMap<string, string>
  readonly observationFile?: string
}
export const makeMonitorPlane = (options: MonitorOptions): EffectPlugin => {
  const catalog = options.catalog ?? makeLiveAppCatalog(options)
  return { id: "monitor", priority: 14, load: async () => {
    const store = createObservationStore(options.observationFile ?? ":memory:")
    const last = new Map<string, string>()
    return {
      stop: () => store.close(),
      canHandle: (path) => /^\/-\/(mirror|weblui|lui|observe)(\/|$)/.test(path),
      handle: async (request) => {
        const url = new URL(request.url)
        const match = url.pathname.match(/^\/-\/(mirror|weblui|lui)\/([^/]+)(\/call)?$/)
        if (match) {
          const id = decodeURIComponent(match[2])
          const app = catalog.find(options.namespace ?? "ops", id)
          if (!app) return Response.json({ ok: false, error: "No such app" }, { status: 404 })
          if (match[3]) {
            if (request.method !== "POST") return new Response(null, { status: 405 })
            try {
              const body = await request.json() as { tool?: unknown; args?: unknown }
              if (typeof body.tool !== "string") throw new Error("tool must be a string")
              return Response.json({ ok: true, result: await invokeAppTool(app, body.tool, body.args ?? {}) })
            } catch (error) {
              return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 })
            }
          }
          if (request.method !== "GET") return new Response(null, { status: 405 })
          return projectView(app, url, app.authorize?.("ui") ? options.uiHtml?.get(id) : undefined)
        }
        if (url.pathname === "/-/observe/tick") {
          let recorded = 0
          for (const app of catalog.list()) {
            if (!app.authorize?.("ui") && !app.authorize?.("interface")) continue
            const data = await parityOf(app), hash = JSON.stringify(data)
            if (last.get(app.appId) === hash) continue
            store.record({ at: Date.now(), perspective: "agent", target: app.appId, data })
            last.set(app.appId, hash); recorded++
          }
          return Response.json({ recorded })
        }
        if (url.pathname === "/-/observe/frames") {
          const perspective = url.searchParams.get("perspective")
          if (perspective && !["app", "agent", "global"].includes(perspective)) return Response.json({ ok: false }, { status: 400 })
          return Response.json(store.frames({ perspective: perspective as "app" | "agent" | "global" | undefined ?? undefined,
            target: url.searchParams.get("target") ?? undefined }))
        }
        return Response.json({ ok: false, detail: "Not found" }, { status: 404 })
      },
    }
  } }
}
