import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { webRenderer, makeRendererRegistry, renderRuntime } from "@effect-agent/ui-renderer"
import type { UICommand } from "@effect-agent/ui-protocol"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
const renderers = makeRendererRegistry([webRenderer])
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "UI Canvas" })
runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "welcome", type: "Text", props: { value: "UI Runtime ready" } } })

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
const shell = (body: string): string => `<!doctype html><html><head><meta charset="utf-8"><title>UI Canvas</title><style>body{font:16px system-ui;margin:2rem}section[data-canvas-ref]{cursor:pointer;padding:.5rem;border:1px dashed #888}#back{margin-bottom:1rem}</style></head><body><button id="back" hidden>Back</button><div id="app">${body}</div><script>const app=document.querySelector('#app'),back=document.querySelector('#back'),history=[];async function show(id){const html=await (await fetch('/api/render?canvasId='+encodeURIComponent(id))).text();app.innerHTML=html;back.hidden=history.length===0;app.querySelectorAll('[data-canvas-ref]').forEach(e=>e.onclick=()=>{history.push(id);show(e.dataset.canvasRef)});}back.onclick=()=>{const id=history.pop();if(id)show(id)};app.querySelectorAll('[data-canvas-ref]').forEach(e=>e.onclick=()=>{history.push('${"root"}');show(e.dataset.canvasRef)});</script></body></html>`
export const startWebHost = (port = Number(process.env.UI_PORT ?? 4870)) => Bun.serve({
  port,
  fetch: async (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/api/canvas") return json(url.searchParams.has("canvasId") ? runtime.viewCanvas(url.searchParams.get("canvasId")!) : runtime.view())
    if (url.pathname === "/api/runtime") return json({ navigation: runtime.navigation(), theme: runtime.theme(), renderer: runtime.renderer() })
    if (url.pathname === "/api/components") return json(definitions.listComponents())
    if (url.pathname === "/api/renderers") return json(renderers.list())
    if (url.pathname === "/api/canvases") return json(Object.values(definitions.snapshot().canvases).map((canvas) => ({ canvasId: canvas.canvasId, title: canvas.title, version: canvas.version })))
    if (url.pathname === "/api/command" && request.method === "POST") {
      try { runtime.apply(await request.json() as UICommand); return json({ ok: true, canvas: runtime.view() }) }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }) }
    }
    if (url.pathname === "/api/render") {
      const canvasId = url.searchParams.get("canvasId")
      const html = canvasId === null ? renderRuntime(renderers, runtime) : webRenderer.render(runtime.viewCanvas(canvasId), { theme: runtime.theme() })
      return new Response(html, { headers: { "content-type": "text/html" } })
    }
    if (url.pathname === "/") return new Response(shell(renderRuntime(renderers, runtime)), { headers: { "content-type": "text/html" } })
    return new Response("Not Found", { status: 404 })
  }
})

if (import.meta.main) startWebHost()
