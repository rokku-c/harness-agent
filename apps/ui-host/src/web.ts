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
    const declared = await operations(request)
    if (declared !== undefined) return declared
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
