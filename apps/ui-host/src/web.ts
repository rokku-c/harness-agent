import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { webRenderer } from "@effect-agent/ui-renderer"
import type { UICommand } from "@effect-agent/ui-protocol"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "UI Canvas" })
runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "welcome", type: "Text", props: { value: "UI Runtime ready" } } })

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
export const startWebHost = (port = Number(process.env.UI_PORT ?? 4870)) => Bun.serve({
  port,
  fetch: async (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/api/canvas") return json(url.searchParams.has("canvasId") ? runtime.viewCanvas(url.searchParams.get("canvasId")!) : runtime.view())
    if (url.pathname === "/api/components") return json(definitions.listComponents())
    if (url.pathname === "/api/canvases") return json(Object.values(definitions.snapshot().canvases).map((canvas) => ({ canvasId: canvas.canvasId, title: canvas.title, version: canvas.version })))
    if (url.pathname === "/api/command" && request.method === "POST") {
      try { runtime.apply(await request.json() as UICommand); return json({ ok: true, canvas: runtime.view() }) }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }) }
    }
    if (url.pathname === "/") return new Response(webRenderer.render(runtime.view(), { theme: url.searchParams.get("theme") ?? "default" }), { headers: { "content-type": "text/html" } })
    return new Response("Not Found", { status: 404 })
  }
})

if (import.meta.main) startWebHost()
