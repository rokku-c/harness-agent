import { expect, test } from "bun:test"

import { makePluginHost } from "../src/index.ts"

const req = (path: string, method = "GET") => new Request("http://x" + path, { method })

test("node-registered routes accept requests before plugin planes / not-found", async () => {
  const host = makePluginHost()
  const unroute = host.registerRoute({
    path: "/-/webhook/*",
    method: "POST",
    handle: async (r) => new Response("got " + r.method),
  })

  expect(await (await host.handle(req("/-/webhook/events", "POST"))).text()).toBe("got POST")

  // method filter: GET to a POST-only route falls through to not-found
  expect((await host.handle(req("/-/webhook/events"))).status).toBe(404)

  unroute()
  expect((await host.handle(req("/-/webhook/events", "POST"))).status).toBe(404)
})
