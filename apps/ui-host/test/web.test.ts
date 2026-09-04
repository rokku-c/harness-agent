import { expect, test } from "bun:test"
import { startWebHost } from "../src/web.ts"

test("web host serves rendered canvas and component catalog", async () => {
  const server = startWebHost(0)
  try {
    const base = server.url
    const page = await (await fetch(base)).text()
    expect(page).toContain("UI Runtime ready")
    const canvas = await (await fetch(new URL("/api/canvas", base))).json() as { canvasId: string }
    expect(canvas.canvasId).toBe("root")
    const selected = await (await fetch(new URL("/api/canvas?canvasId=root", base))).json() as { canvasId: string }
    expect(selected.canvasId).toBe("root")
    const components = await (await fetch(new URL("/api/components", base))).json() as Array<{ type: string }>
    expect(components.some((item) => item.type === "CanvasRef")).toBe(true)
    const renderers = await (await fetch(new URL("/api/renderers", base))).json() as string[]
    expect(renderers).toContain("web-html")
    const canvases = await (await fetch(new URL("/api/canvases", base))).json() as Array<{ canvasId: string }>
    expect(canvases.some((item) => item.canvasId === "root")).toBe(true)
    const command = await fetch(new URL("/api/command", base), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "insert-node", canvasId: "root", node: { id: "from-http", type: "Text", props: { value: "HTTP" } } }) })
    expect((await command.json() as { ok: boolean }).ok).toBe(true)
    await fetch(new URL("/api/command", base), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "set-theme", theme: "contrast" }) })
    const rendered = await (await fetch(new URL("/api/render", base))).text()
    expect(rendered).toContain('data-theme="contrast"')
  } finally { server.stop(true) }
})
