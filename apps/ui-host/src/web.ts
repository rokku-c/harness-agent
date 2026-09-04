import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { webRenderer } from "@effect-agent/ui-renderer"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "UI Canvas" })
runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "welcome", type: "Text", props: { value: "UI Runtime ready" } } })

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
export const startWebHost = (port = Number(process.env.UI_PORT ?? 4870)) => Bun.serve({
  port,
  fetch: (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/api/canvas") return json(runtime.view())
    if (url.pathname === "/api/components") return json(definitions.listComponents())
    if (url.pathname === "/") return new Response(webRenderer.render(runtime.view(), { theme: url.searchParams.get("theme") ?? "default" }), { headers: { "content-type": "text/html" } })
    return new Response("Not Found", { status: 404 })
  }
})

if (import.meta.main) startWebHost()
