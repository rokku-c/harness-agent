import { expect, test } from "bun:test"
import { createDeckPlugin } from "../src/effect-plugin.ts"

const { apiUrl } = await import(new URL("../public/client/api.js", import.meta.url).href)
test("Deck browser requests resolve from the served module URL on any host port", () => {
  for (const prefix of ["", "/deck"]) {
    const moduleUrl = `https://shared.example:7443${prefix}/client/api.js`
    const url = apiUrl("/api/config/preview?kind=demo", moduleUrl)
    expect(url.origin).toBe("https://shared.example:7443")
    expect(url.pathname).toBe(prefix + "/api/config/preview")
    expect(url.searchParams.get("kind")).toBe("demo")
  }
})

test("Deck prefix preserves methods, body, queries and static asset boundaries", async () => {
  const plane = await createDeckPlugin(() => ({ configFile: ":memory:" }), { fetch }).load()
  const request = (path: string, init?: RequestInit) => plane.handle(new Request("http://shared" + path, init))
  try {
    for (const path of ["/deck", "/deck/", "/deck/index.html"]) {
      const page = await request(path)
      expect(page.status).toBe(200)
      expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8")
    }
    for (const path of ["/deck/client/main.js", "/deck/client/api.js", "/deck/app.css"]) {
      const response = await request(path)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe(path.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8")
    }
    expect((await request("/deck/client/missing.js")).status).toBe(404)
    expect((await request("/deck/client/main.js", { method: "POST" })).status).toBe(404)
    expect((await request("/api/deck")).status).toBe(404)
    const added = await request("/deck/api/launchers", { method: "POST", body: JSON.stringify({ kind: "demo", label: "a b" }) })
    expect(await added.json()).toEqual({ ok: true, launchers: [{ kind: "demo", label: "a b" }] })
    const deleted = await request("/deck/api/launchers/a%20b?kind=demo", { method: "DELETE" })
    expect(await deleted.json()).toEqual({ ok: true, removed: { kind: "demo", label: "a b" } })
    const preview = await request("/deck/api/config/preview?kind=demo")
    expect(await preview.json()).toMatchObject({ ok: true, kind: "demo", invocation: null })
  } finally { await plane.stop?.() }
})
