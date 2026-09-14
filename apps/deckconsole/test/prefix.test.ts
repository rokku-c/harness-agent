import { expect, test } from "bun:test"
import { createDeckPlugin } from "../src/effect-plugin.ts"

test("Deck prefix preserves methods, body and queries, and serves no page", async () => {
  const plane = await createDeckPlugin(() => ({ configFile: ":memory:" }), { fetch }).load()
  const request = (path: string, init?: RequestInit) => plane.handle(new Request("http://shared" + path, init))
  try {
    // The deck's UI is its declarative view in the console, so the mount serves
    // the operations and answers everything else with the deck's own 404.
    for (const path of ["/deck", "/deck/", "/deck/index.html", "/deck/client/main.js"]) {
      expect((await request(path)).status).toBe(404)
    }
    expect((await request("/api/deck")).status).toBe(404)
    const added = await request("/deck/api/launchers", { method: "POST", body: JSON.stringify({ kind: "demo", label: "a b" }) })
    expect(await added.json()).toEqual({ ok: true, launchers: [{ kind: "demo", label: "a b" }] })
    const deleted = await request("/deck/api/launchers/a%20b?kind=demo", { method: "DELETE" })
    expect(await deleted.json()).toEqual({ ok: true, removed: { kind: "demo", label: "a b" } })
    const preview = await request("/deck/api/config/preview?kind=demo")
    expect(await preview.json()).toMatchObject({ ok: true, kind: "demo", invocation: null })
  } finally { await plane.stop?.() }
})
