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
    const components = await (await fetch(new URL("/api/components", base))).json() as Array<{ type: string }>
    expect(components.some((item) => item.type === "CanvasRef")).toBe(true)
  } finally { server.stop(true) }
})
