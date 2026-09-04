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
    const command = await fetch(new URL("/api/command", base), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "insert-node", canvasId: "root", node: { id: "from-http", type: "Text", props: { value: "HTTP" } } }) })
    expect((await command.json() as { ok: boolean }).ok).toBe(true)
  } finally { server.stop(true) }
})
