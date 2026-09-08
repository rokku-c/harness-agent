import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { registerEffectApp } from "../src/index.ts"

test("SDK automatically derives a prefix route from an app's declared path", async () => {
  const host = makePluginHost()
  const dispose = await registerEffectApp({ host }, { id: "app", path: "/app",
    createPlugin: () => ({ id: "app", load: async () => ({ handle: async () => new Response("ok") }) }),
  })
  expect(await (await host.handle(new Request("http://port/app/child"))).text()).toBe("ok")
  expect((await host.handle(new Request("http://port/apple"))).status).toBe(404)
  await dispose()
  expect((await host.handle(new Request("http://port/app/child"))).status).toBe(404)
  await host.close()
})
