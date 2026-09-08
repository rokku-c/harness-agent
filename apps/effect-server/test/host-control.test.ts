import { expect, test } from "bun:test"
import { makePluginHost, type EffectPlugin } from "@effect-agent/effect-host"
const req = (path: string, init?: RequestInit) => new Request("http://test" + path, init)

const probe: EffectPlugin = {
  id: "probe",
  load: async () => ({
    canHandle: (path: string) => path === "/probe",
    handle: async () => new Response("pong", { status: 200 }),
  }),
}

test("host registers plugins and hot-enables/disables/removes them", async () => {
  const host = makePluginHost({ control: true })
  await host.register(probe)

  expect(await (await host.handle(req("/probe"))).text()).toBe("pong")

  // a plugin registered disabled loads nothing until enabled
  const hot = { ...probe, id: "hot", enabled: false }
  await host.register(hot)
  expect(host.isEnabled("hot")).toBe(false)
  expect((await host.handle(req("/probe"))).status).toBe(200)

  await host.handle(req("/-/planes/hot/enable", { method: "POST" }))
  expect(host.isEnabled("hot")).toBe(true)
  await host.handle(req("/-/planes/hot/disable", { method: "POST" }))
  expect(host.isEnabled("hot")).toBe(false)
  await host.handle(req("/-/planes/hot", { method: "DELETE" }))
  expect(host.list().map((p) => p.id)).toEqual(["probe"])
  await host.close()
})

