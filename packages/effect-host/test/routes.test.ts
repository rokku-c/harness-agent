import { expect, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"

const req = (path: string) => new Request(`http://any-listener${path}`)
test("SDK route declarations and port selection resolve the exact same app", async () => {
  const host = makePluginHost()
  await host.register({ id: "app", routes: [{ path: "/app", match: "prefix" }],
    load: async () => ({ handle: async () => Response.json({ owner: "app" }) }),
  })
  expect(host.resolveApp(req("/app"))).toBe("app")
  expect(host.resolveApp(req("/app/state"))).toBe("app")
  expect(host.resolveApp(req("/apple"))).toBeUndefined()
  expect((await host.handle(req("/apple"))).status).toBe(404)
  expect(await (await host.handle(req("/app/state"))).json()).toEqual({ owner: "app" })
  expect(host.routes()).toEqual([{ appId: "app", path: "/app", match: "prefix" }])
  await host.disable("app")
  expect(host.routes()).toEqual([])
  expect(host.resolveApp(req("/app"))).toBeUndefined()
  await host.enable("app")
  expect(host.resolveApp(req("/app"))).toBe("app")
  await host.close()
})
test("invalid path and unknown route match reject before loading", async () => {
  const host = makePluginHost()
  let loaded = false
  await expect(host.register({ id: "bad", routes: [{ path: "missing-leading-slash" }], load: async () => {
    loaded = true; return { handle: async () => new Response(null) }
  } })).rejects.toThrow("Invalid route")
  expect(loaded).toBe(false)
  await host.close()
})
