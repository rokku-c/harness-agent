import { expect, test } from "bun:test"
import { createUiHostPlugin } from "../src/effect-plugin.ts"

const { renderUrl } = await import(new URL("../public/canvas.js", import.meta.url).href)
test("canvas navigation resolves API URLs against the served module prefix", () => {
  for (const prefix of ["", "/ui"]) {
    const moduleUrl = `https://shared.example:7443${prefix}/canvas.js`
    const url = renderUrl("a/b ?", moduleUrl)
    expect(url.origin).toBe("https://shared.example:7443")
    expect(url.pathname).toBe(prefix + "/api/render")
    expect(url.searchParams.get("canvasId")).toBe("a/b ?")
  }
})

test("UI prefix rewriting serves both root variants, preserves POST body and query", async () => {
  const plane = await createUiHostPlugin(() => ({ databaseFile: ":memory:" }), { fetch }).load()
  try {
    for (const path of ["/ui", "/ui/"]) {
      const response = await plane.handle(new Request("http://shared" + path))
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("text/html")
    }
    const asset = await plane.handle(new Request("http://shared/ui/canvas.js"))
    expect(asset.status).toBe(200)
    expect(asset.headers.get("content-type")).toBe("text/javascript")
    const posted = await plane.handle(new Request("http://shared/ui/api/command", {
      method: "POST", body: JSON.stringify({ kind: "create-canvas", canvasId: "other", title: "Other" }),
    }))
    expect(await posted.json()).toMatchObject({ ok: true })
    const queried = await plane.handle(new Request("http://shared/ui/api/canvas?canvasId=other"))
    expect(await queried.json()).toMatchObject({ canvasId: "other" })
    expect((await plane.handle(new Request("http://shared/api/canvas"))).status).toBe(404)
  } finally { await plane.stop?.() }
})
