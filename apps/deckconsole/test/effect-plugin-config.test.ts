import { expect, mock, spyOn, test } from "bun:test"
import { Database } from "bun:sqlite"
import { makePluginHost } from "@effect-agent/effect-host"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { effectApp } from "../src/effect-app.ts"
import { createDeckPlugin } from "../src/effect-plugin.ts"
import { createDeckApp, type DeckOptions } from "../src/app.ts"

const context = { fetch: mock(() => Promise.reject(new Error("unused egress"))) }
test("SDK mounts Deck without listening; reload and unregister dispose SQLite and session state", async () => {
  expect(effectApp.createPlugin).toBe(createDeckPlugin)
  expect(effectApp.plugin).toBeUndefined()
  let active = { host: "0.0.0.0", port: 4859, configFile: ":memory:" }
  const created: DeckOptions[] = [], apps: ReturnType<typeof createDeckApp>[] = []
  const make = (options: DeckOptions) => { created.push(options); const app = createDeckApp(options); apps.push(app); return app }
  const close = spyOn(Database.prototype, "close")
  const serve = spyOn(Bun, "serve").mockImplementation(() => { throw new Error("hidden listener") })
  const host = makePluginHost()
  try {
    const dispose = await registerEffectApp({ host, activeConfig: () => active }, {
      ...effectApp, createPlugin: (get, ctx) => createDeckPlugin(get, ctx, make),
    })
    expect(created).toEqual([{ configFile: ":memory:", basePath: "/deck" }])
    expect(host.routes()).toEqual([{ appId: "deckconsole", path: "/deck", match: "prefix" }])
    const opened = await host.handle(new Request("http://deck/deck/api/session", { method: "POST", body: JSON.stringify({ sessionId: "owned" }) }))
    expect(await opened.json()).toMatchObject({ ok: true })
    for (const path of ["/api/deck", "/deck-other"]) expect((await host.handle(new Request("http://deck" + path))).status).toBe(404)
    active = { ...active, port: 4999 }
    await host.disable("deckconsole")
    await host.enable("deckconsole")
    expect(close).toHaveBeenCalledTimes(1)
    expect(apps[0].deck.sessions()).toEqual([])
    expect(await (await host.handle(new Request("http://deck/deck/api/deck"))).json()).toMatchObject({ sessions: [] })
    expect(created[1]).toEqual({ configFile: ":memory:", basePath: "/deck" })
    await dispose()
    expect(host.routes()).toEqual([])
    expect(close).toHaveBeenCalledTimes(2)
    expect(serve).not.toHaveBeenCalled()
  } finally { await host.close(); serve.mockRestore(); close.mockRestore() }
})

test("schema defaults never fall through to DECK_FILE and invalid config allocates nothing", async () => {
  const previous = process.env.DECK_FILE
  process.env.DECK_FILE = "must-not-open.sqlite"
  const make = mock((_options: DeckOptions) => ({ handle: async (r: Request) => Response.json({ path: new URL(r.url).pathname }), close: () => {} }))
  try {
    const plane = await createDeckPlugin(() => ({}), context, make).load()
    expect(make.mock.calls[0][0]).toEqual({ configFile: ".effect-agent/deckconsole.sqlite", basePath: "/deck" })
    expect(await (await plane.handle(new Request("http://deck/deck/api/config"))).json()).toEqual({ path: "/api/config" })
    expect((await plane.handle(new Request("http://deck/deck-other"))).status).toBe(404)
    await plane.stop?.()
    make.mockClear()
    await expect(createDeckPlugin(() => ({ configFile: 42 }), context, make).load()).rejects.toThrow()
    expect(make).not.toHaveBeenCalled()
    expect(context.fetch).not.toHaveBeenCalled()
  } finally {
    if (previous === undefined) delete process.env.DECK_FILE
    else process.env.DECK_FILE = previous
  }
})
