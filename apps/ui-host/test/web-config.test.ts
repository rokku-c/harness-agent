import { expect, spyOn, test } from "bun:test"
import { webRenderer } from "@effect-agent/ui-renderer"
import { makeWebHandler } from "../src/web.ts"

const request = (path: string) => new Request("http://ui" + path)
const command = (body: unknown) => new Request("http://ui/api/command", { method: "POST", body: JSON.stringify(body) })

test("the one renderer draws the current canvas and a named one the same way", async () => {
  const app = makeWebHandler({ databaseFile: ":memory:", theme: "dusk" })
  const render = spyOn(webRenderer, "render")
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
  } finally { app.close(); render.mockRestore() }
})

test("runtime commands cannot leak into another handler", async () => {
  const first = makeWebHandler({ databaseFile: ":memory:", theme: "dusk" })
  const second = makeWebHandler({ databaseFile: ":memory:", theme: "warm-paper" })
  try {
    await first.handle(command({ kind: "create-canvas", canvasId: "private", title: "Private" }))
    await first.handle(command({ kind: "set-theme", theme: "changed" }))
    expect(await (await second.handle(request("/api/runtime"))).json()).toMatchObject({ theme: "warm-paper" })
    for (const [app, ids] of [[first, ["root", "private"]], [second, ["root"]]] as const) {
      const canvases = await (await app.handle(request("/api/canvases"))).json() as { canvasId: string }[]
      expect(canvases.map(c => c.canvasId)).toEqual([...ids])
    }
  } finally { first.close(); second.close() }
})

test("a command body that cannot be read is refused and leaves the theme in force", async () => {
  const app = makeWebHandler({ databaseFile: ":memory:", theme: "dusk" })
  try {
    const refused = await (await app.handle(new Request("http://ui/api/command", { method: "POST", body: "{not json" }))).json()
    expect(refused).toMatchObject({ ok: false })
    expect(typeof (refused as { error: unknown }).error).toBe("string")
    expect(await (await app.handle(request("/api/runtime"))).json()).toMatchObject({ theme: "dusk" })
  } finally { app.close() }
})
