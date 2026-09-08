import { expect, mock, spyOn, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { effectApp } from "../src/effect-app.ts"
import { createUiHostPlugin } from "../src/effect-plugin.ts"
import { makeWebHandler, type WebHandlerOptions } from "../src/web.ts"

const context = { fetch: mock(() => Promise.reject(new Error("unused egress"))) }
test("SDK routes UI handlers without listening; reload reads active config and closes each instance", async () => {
  expect(effectApp.createPlugin).toBe(createUiHostPlugin)
  expect(effectApp.plugin).toBeUndefined()
  let active = { host: "0.0.0.0", port: 4880, theme: "dusk", renderer: "json-render-react", databaseFile: ":memory:" }
  const created: WebHandlerOptions[] = [], stops: ReturnType<typeof mock>[] = []
  const read = mock(() => active)
  const make = (options: WebHandlerOptions) => {
    created.push(options)
    const app = makeWebHandler(options), close = mock(app.close)
    stops.push(close)
    return { handle: app.handle, close }
  }
  const serve = spyOn(Bun, "serve").mockImplementation(() => { throw new Error("hidden listener") })
  const host = makePluginHost()
  try {
    const dispose = await registerEffectApp({ host, activeConfig: read }, {
      ...effectApp, createPlugin: (get, ctx) => createUiHostPlugin(get, ctx, make),
    })
    expect(created).toEqual([{ theme: "dusk", renderer: "json-render-react", databaseFile: ":memory:", basePath: "/ui" }])
    expect(host.routes()).toEqual([{ appId: "ui-host", path: "/ui", match: "prefix" }])
    const response = await host.handle(new Request("http://ui/ui/api/runtime"))
    expect(await response.json()).toMatchObject({ theme: "dusk", renderer: "json-render-react" })
    for (const path of ["/api/runtime", "/ui-other"]) expect((await host.handle(new Request("http://ui" + path))).status).toBe(404)
    active = { ...active, theme: "warm-paper", renderer: "web-html" }
    await host.disable("ui-host")
    await host.enable("ui-host")
    expect(await (await host.handle(new Request("http://ui/ui/api/runtime"))).json())
      .toMatchObject({ theme: "warm-paper", renderer: "web-html" })
    expect(read).toHaveBeenCalledTimes(2)
    await dispose()
    expect(host.routes()).toEqual([])
    for (const stop of stops) expect(stop).toHaveBeenCalledTimes(1)
    expect(serve).not.toHaveBeenCalled()
  } finally { await host.close(); serve.mockRestore() }
})

test("defaults do not consult environment providers; invalid config allocates nothing", async () => {
  const previous = process.env.UI_DATABASE
  process.env.UI_DATABASE = "must-not-open.sqlite"
  const make = mock((_options: WebHandlerOptions) => ({ handle: async () => new Response(), close: () => {} }))
  try {
    const plane = await createUiHostPlugin(() => ({}), context, make).load()
    expect(make.mock.calls[0][0]).toEqual({ theme: "warm-paper", renderer: "web-html", databaseFile: ".effect-agent/ui.sqlite", basePath: "/ui" })
    await plane.stop?.()
    make.mockClear()
    await expect(createUiHostPlugin(() => ({ renderer: "missing" }), context, make).load()).rejects.toThrow()
    expect(make).not.toHaveBeenCalled()
    expect(context.fetch).not.toHaveBeenCalled()
  } finally {
    if (previous === undefined) delete process.env.UI_DATABASE
    else process.env.UI_DATABASE = previous
  }
})
