import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { jsonReactRenderer, webRenderer, makeRendererRegistry, renderRuntime } from "@effect-agent/ui-renderer"
import type { UICommand } from "@effect-agent/ui-protocol"
import { makeExtensionRegistry } from "@effect-agent/ui-extension"
import { makeActivityStore } from "./activity.ts"
import { shell } from "./shell.ts"

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
export interface WebHandlerOptions {
  readonly theme?: string
  readonly renderer?: string
  readonly databaseFile?: string
  readonly basePath?: string
}

/** Each load gets isolated state, so an apply/reload cannot reuse the old runtime. */
export const makeWebHandler = (options: WebHandlerOptions = {}) => {
  const definitions = registerBuiltins(makeDefinitionStore())
  const runtime = makeUIRuntime(definitions, "root")
  const renderers = makeRendererRegistry([webRenderer, jsonReactRenderer])
  const extensions = makeExtensionRegistry(definitions)
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "UI Canvas" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "welcome", type: "Text", props: { value: "UI Runtime ready" } } })

  // Runtime accepts theme identifiers. warm-paper/dusk have no registered palette;
  // web-html emits the identifier only and json-render-react does not consume themes.
  runtime.setTheme(options.theme ?? "default")
  const renderer = options.renderer ?? "web-html"
  if (renderers.get(renderer) === undefined) throw new Error("renderer not found: " + renderer)
  runtime.setRenderer(renderer)
  const activity = makeActivityStore(options.databaseFile)
  let closed = false
  const handle = async (request: Request): Promise<Response> => {
    if (closed) return new Response("UI closed", { status: 503 })
    const url = new URL(request.url)
    if (url.pathname === "/canvas.js") return new Response(Bun.file(new URL("../public/canvas.js", import.meta.url)), { headers: { "content-type": "text/javascript" } })
    if (url.pathname === "/api/canvas") return json(url.searchParams.has("canvasId") ? runtime.viewCanvas(url.searchParams.get("canvasId")!) : runtime.view())
    if (url.pathname === "/api/runtime") return json({ navigation: runtime.navigation(), theme: runtime.theme(), renderer: runtime.renderer() })
    if (url.pathname === "/api/components") return json(definitions.listComponents())
    if (url.pathname === "/api/extensions") return json(extensions.list())
    if (url.pathname === "/api/activity") return json({ statuses: activity.statuses(), events: activity.list() })
    if (url.pathname === "/api/status" && request.method === "POST") {
      const body = await request.json() as { agent?: string; status?: string }
      if (typeof body.agent !== "string" || typeof body.status !== "string") return json({ ok: false, error: "agent and status are required" })
      return json({ ok: true, event: activity.setStatus(body.agent, body.status) })
    }
    if (url.pathname === "/api/renderers") return json(renderers.list())
    if (url.pathname === "/api/canvases") return json(Object.values(definitions.snapshot().canvases).map((canvas) => ({ canvasId: canvas.canvasId, title: canvas.title, version: canvas.version })))
    if (url.pathname === "/api/command" && request.method === "POST") {
      try {
        const command = await request.json() as UICommand
        if (command.kind === "set-renderer" && renderers.get(command.renderer) === undefined) return json({ ok: false, error: "renderer not found: " + command.renderer })
        runtime.apply(command); return json({ ok: true, canvas: runtime.view() })
      }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }) }
    }
    if (url.pathname === "/api/render") {
      const canvasId = url.searchParams.get("canvasId")
      const html = canvasId === null ? renderRuntime(renderers, runtime) : renderers.get(runtime.renderer())!.render(runtime.viewCanvas(canvasId), { theme: runtime.theme() })
      return new Response(html, { headers: { "content-type": "text/html" } })
    }
    if (url.pathname === "/") return new Response(shell(renderRuntime(renderers, runtime), options.basePath ?? ""), { headers: { "content-type": "text/html" } })
    return new Response("Not Found", { status: 404 })
  }
  return { handle, close: () => { closed = true; activity.close() } }
}
