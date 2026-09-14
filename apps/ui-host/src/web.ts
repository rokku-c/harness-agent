/**
 * The embedded host: the routes the console reads, over one runtime.
 *
 * There is one renderer here and it is named, not selected. `makeRendererRegistry`
 * and a `renderer` option used to sit between this file and the page, which made
 * "how is a canvas drawn" a lookup that could disagree with itself; the host now
 * calls the web renderer directly, so an agent-authored canvas and an app-declared
 * screen are drawn by one path (flows.md §A8).
 */
import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { webRenderer } from "@effect-agent/ui-renderer"
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
  readonly databaseFile?: string
  readonly basePath?: string
}

/** Each load gets isolated state, so an apply/reload cannot reuse the old runtime. */
export const makeWebHandler = (options: WebHandlerOptions = {}) => {
  const canvasStore = makeCanvasStore(options.databaseFile ?? ".effect-agent/ui.sqlite")
  const definitions = registerBuiltins(makeDefinitionStore(canvasStore.load()))
  const runtime = makeUIRuntime(definitions, "root")
  const extensions = makeExtensionRegistry(definitions)
  if (definitions.getCanvas("root") === undefined) {
    runtime.apply({ kind: "create-canvas", canvasId: "root", title: "UI Canvas" })
    runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "welcome", type: "Text", props: { value: "UI Runtime ready" } } })
    canvasStore.save(definitions.snapshot())
  }
  runtime.setTheme(options.theme ?? "default")
  const activity = makeActivityStore(options.databaseFile)
  const surfaces: UiSurfaces = { runtime, definitions, extensions, activity }
  const operations = toHttpHandler(uiOperations(surfaces))
  /** The one renderer's answer for a canvas, which is the whole of the page's body. */
  const draw = (canvasId: string | null): string =>
    webRenderer.render(canvasId === null ? runtime.view() : runtime.viewCanvas(canvasId), { theme: runtime.theme() })
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
        runtime.apply(await request.json() as UICommand); canvasStore.save(definitions.snapshot()); return json({ ok: true, canvas: runtime.view() })
      }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }) }
    }
    if (url.pathname === "/api/render") return new Response(draw(url.searchParams.get("canvasId")), { headers: { "content-type": "text/html" } })
    if (url.pathname === "/") return new Response(shell(draw(null), options.basePath ?? ""), { headers: { "content-type": "text/html" } })
    return new Response("Not Found", { status: 404 })
  }
  return { handle, tools: makeUiTools(surfaces), close: () => { closed = true; activity.close(); canvasStore.close() } }
}
