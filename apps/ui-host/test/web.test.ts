import { expect, test } from "bun:test"
import { makeWebHandler } from "../src/web.ts"

test("handler serves shell, catalog, canvas navigation, status and runtime commands", async () => {
  const app = makeWebHandler({ databaseFile: ":memory:" })
  const request = (path: string, body?: unknown) => app.handle(new Request("http://ui" + path,
    body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }))
  const get = async (path: string) => (await request(path)).json() as Promise<any>
  try {
    const shell = await request("/")
    expect(shell.status).toBe(200)
    expect(shell.headers.get("content-type")).toBe("text/html")
    expect(await get("/api/canvas?canvasId=root")).toMatchObject({ canvasId: "root" })
    expect(await get("/api/runtime")).toMatchObject({ renderer: "web-html" })
    const catalog = await get("/api/components")
    expect(catalog.map((c: { type: string }) => c.type)).toContain("Text")
    expect(await get("/api/extensions")).toEqual([])
    await request("/api/status", { agent: "Codex", status: "Rendering" })
    expect(await get("/api/activity")).toMatchObject({ statuses: { Codex: "Rendering" } })
    const command = (body: unknown) => request("/api/command", body)
    expect(await (await command({ kind: "create-canvas", canvasId: "details", title: "Details" })).json()).toMatchObject({ ok: true })
    await command({ kind: "set-theme", theme: "contrast" })
    await command({ kind: "set-renderer", renderer: "json-render-react" })
    expect(await get("/api/runtime")).toMatchObject({ theme: "contrast", renderer: "json-render-react" })
  } finally { app.close() }
})
