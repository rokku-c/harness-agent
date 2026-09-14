/**
 * The host's routes: the declared surface, over one runtime.
 *
 * There is no page here and no HTML. A canvas used to be drawn twice — once by
 * this host into a document of its own, once by the console from the declared
 * screens — and two renderings of one canvas are two answers to one question,
 * which is the thing the design refuses (design-system §2). The console is the
 * only surface an operator reads a canvas on now, and it reads it through the
 * declared read below, so what an agent wrote and what the screen shows are one
 * answer. The routes it reads are the same routes they were; only the document
 * that used to be served beside them is gone.
 *
 * What is left is data: the reads an agent and a screen share, and the one write
 * that arrives from a browser rather than from a tool — the console's own
 * envelope, `POST /api/command`, which carries a `UICommand` instead of a named
 * call (`ops/canvas.ts`).
 */
import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { toHttpHandler } from "@effect-agent/effect-interface"
import { json } from "@effect-agent/effect-host"
import type { UICommand } from "@effect-agent/ui-protocol"
import { makeExtensionRegistry } from "@effect-agent/ui-extension"
import { makeActivityStore } from "./activity.ts"
import { makeCanvasStore } from "./canvas-store.ts"
import { makeUiTools, uiOperations, type UiSurfaces } from "./ops/index.ts"

export interface WebHandlerOptions {
  readonly theme?: string
  readonly databaseFile?: string
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
  let closed = false
  const handle = async (request: Request): Promise<Response> => {
    if (closed) return new Response("UI closed", { status: 503 })
    // the declared surface first: every read, and the one write that arrives
    // from an agent rather than from the console
    const declared = await operations(request)
    if (declared !== undefined) return declared
    // The console's own writes arrive as a `UICommand` rather than as a named
    // call, which is why they are the host's route and not a declaration.
    if (new URL(request.url).pathname === "/api/command" && request.method === "POST") {
      try {
        runtime.apply(await request.json() as UICommand); canvasStore.save(definitions.snapshot()); return json({ ok: true, canvas: runtime.view() })
      }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }) }
    }
    return new Response("Not Found", { status: 404 })
  }
  return { handle, tools: makeUiTools(surfaces), close: () => { closed = true; activity.close(); canvasStore.close() } }
}
