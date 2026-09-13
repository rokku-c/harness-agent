import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { jsonReactRenderer, webRenderer, makeRendererRegistry, renderRuntime } from "@effect-agent/ui-renderer"
import { toHttpHandler } from "@effect-agent/effect-interface"
import { json } from "@effect-agent/effect-host"
import type { UICommand } from "@effect-agent/ui-protocol"
import { makeExtensionRegistry } from "@effect-agent/ui-extension"
import { makeActivityStore } from "./activity.ts"
import { makeCanvasStore } from "./canvas-store.ts"
import { makeUiTools, uiOperations, type UiSurfaces } from "./ops/index.ts"
import { shell } from "./shell.ts"

export interface WebHandlerOptions {
  readonly theme?: string
  readonly renderer?: string
  readonly databaseFile?: string
  readonly basePath?: string
}

/** Each load gets isolated state, so an apply/reload cannot reuse the old runtime. */
export const makeWebHandler = (options: WebHandlerOptions = {}) => {
  const canvasStore = makeCanvasStore(options.databaseFile ?? ".effect-agent/ui.sqlite")
  const definitions = registerBuiltins(makeDefinitionStore(canvasStore.load()))
  const runtime = makeUIRuntime(definitions, "root")
  const renderers = makeRendererRegistry([webRenderer, jsonReactRenderer])
  const extensions = makeExtensionRegistry(definitions)
  if (definitions.getCanvas("root") === undefined) {
    runtime.apply({ kind: "create-canvas", canvasId: "root", title: "UI Canvas" })
    runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "welcome", type: "Text", props: { value: "UI Runtime ready" } } })
    canvasStore.save(definitions.snapshot())
  }

  // Runtime accepts theme identifiers. warm-paper/dusk have no registered palette;
  // web-html emits the identifier only and json-render-react does not consume themes.
  runtime.setTheme(options.theme ?? "default")
  const renderer = options.renderer ?? "web-html"
  if (renderers.get(renderer) === undefined) throw new Error("renderer not found: " + renderer)
  runtime.setRenderer(renderer)
  const activity = makeActivityStore(options.databaseFile)
  const surfaces: UiSurfaces = { runtime, definitions, renderers, extensions, activity }
  const operations = toHttpHandler(uiOperations(surfaces))
  let closed = false
  const handle = async (request: Request): Promise<Response> => {
    if (closed) return new Response("UI closed", { status: 503 })
    const url = new URL(request.url)
    // the declared surface first: every read, and the one write that arrives
    // from an agent rather than from the page
    const declared = await operations(request)
    if (declared !== undefined) return declared
    if (url.pathname === "/canvas.js") return new Response(Bun.file(new URL("../public/canvas.js", import.meta.url)), { headers: { "content-type": "text/javascript" } })
    // The page's own writes arrive as a `UICommand` rather than as a named
    // call, which is why they are the host's route and not a declaration.
    if (url.pathname === "/api/command" && request.method === "POST") {
      try {
        const command = await request.json() as UICommand
        if (command.kind === "set-renderer" && renderers.get(command.renderer) === undefined) return json({ ok: false, error: "renderer not found: " + command.renderer })
        runtime.apply(command); canvasStore.save(definitions.snapshot()); return json({ ok: true, canvas: runtime.view() })
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
  return { handle, tools: makeUiTools(surfaces), close: () => { closed = true; activity.close(); canvasStore.close() } }
}
