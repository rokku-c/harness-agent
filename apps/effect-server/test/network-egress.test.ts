import { expect, test } from "bun:test"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { networkFixture } from "./network-fixture.ts"

test("peer app exits through authenticated main node; target credentials stay separate", async () => {
  const token = "test-relay-token-at-least-16"
  let seen: { authorization: string | null; body: string; relayHeader: string | null } | undefined
  const upstream = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    seen = { authorization: request.headers.get("authorization"), body: await request.text(), relayHeader: request.headers.get("x-effect-app") }
    return new Response("streamed-result", { headers: { "content-type": "text/event-stream" } })
  } })
  const main = await networkFixture({ role: "main", listeners: [{ id: "main", port: 0 }], relayToken: token })
  await registerEffectApp(main.app, { id: "worker", egress: "main-first" })
  const [port] = await main.app.listen()
  const peer = await networkFixture({ role: "peer", localAvailable: false, main: { url: port.url, token }, listeners: [] })
  try {
    await registerEffectApp(peer.app, { id: "worker", routes: [{ path: "/work" }], egress: "main-only",
      createPlugin: (_config, context) => ({ id: "worker", load: async () => ({ handle: async () => context.fetch(upstream.url, {
        method: "POST", headers: { authorization: "Bearer upstream-only" }, body: "task",
      }) }) }),
    })
    const response = await peer.app.host.handle(new Request("http://peer/work"))
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(await response.text()).toBe("streamed-result")
    expect(seen).toEqual({ authorization: "Bearer upstream-only", body: "task", relayHeader: null })
    const rejected = await fetch(new URL("/-/network/egress", port.url), { method: "POST" })
    expect(rejected.status).toBe(401)
  } finally { await peer.close(); await main.close(); upstream.stop(true) }
})
