import { expect, spyOn, test } from "bun:test"
import { jsonReactRenderer, webRenderer } from "@effect-agent/ui-renderer"
import { makeWebHandler } from "../src/web.ts"

const request = (path: string) => new Request("http://ui" + path)
const command = (body: unknown) => new Request("http://ui/api/command", { method: "POST", body: JSON.stringify(body) })

test("configured renderer receives both current and named canvas renders", async () => {
  const app = makeWebHandler({ databaseFile: ":memory:", theme: "dusk", renderer: "json-render-react" })
  const render = spyOn(jsonReactRenderer, "render"), web = spyOn(webRenderer, "render")
  try {
    for (const path of ["/api/render", "/api/render?canvasId=root"]) {
      const response = await app.handle(request(path))
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("text/html")
    }
    expect(render).toHaveBeenCalledTimes(2)
    for (const [tree, context] of render.mock.calls) {
      expect(tree.canvasId).toBe("root")
      expect(context?.theme).toBe("dusk")
    }
    expect(web).not.toHaveBeenCalled()
  } finally { app.close(); render.mockRestore(); web.mockRestore() }
})

test("runtime commands cannot leak into another handler", async () => {
  const first = makeWebHandler({ databaseFile: ":memory:", theme: "dusk" })
  const second = makeWebHandler({ databaseFile: ":memory:", theme: "warm-paper" })
  try {
    await first.handle(command({ kind: "create-canvas", canvasId: "private", title: "Private" }))
    await first.handle(command({ kind: "set-theme", theme: "changed" }))
    expect(await (await second.handle(request("/api/runtime"))).json()).toMatchObject({ theme: "warm-paper", renderer: "web-html" })
    for (const [app, ids] of [[first, ["root", "private"]], [second, ["root"]]] as const) {
      const canvases = await (await app.handle(request("/api/canvases"))).json() as { canvasId: string }[]
      expect(canvases.map(c => c.canvasId)).toEqual([...ids])
    }
  } finally { first.close(); second.close() }
})

test("unknown renderer is rejected; an invalid command keeps the active renderer", async () => {
  expect(() => makeWebHandler({ databaseFile: ":memory:", renderer: "missing" })).toThrow("renderer not found: missing")
  const app = makeWebHandler({ databaseFile: ":memory:", renderer: "json-render-react" })
  try {
    expect(await (await app.handle(command({ kind: "set-renderer", renderer: "missing" }))).json())
      .toEqual({ ok: false, error: "renderer not found: missing" })
    expect(await (await app.handle(request("/api/runtime"))).json()).toMatchObject({ renderer: "json-render-react" })
  } finally { app.close() }
})
