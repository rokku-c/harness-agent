import { expect, test } from "bun:test"

import { makePluginHost } from "@effect-agent/effect-host"
import { makeAiGatewayEffectPlugin } from "../../ai-gateway/src/effect-plugin.ts"
import { createBoardPlugin } from "../../board/src/effect/plugin.ts"
import { createUiHostPlugin } from "../../ui-host/src/effect-plugin.ts"

const req = (path: string, init?: RequestInit) => new Request("http://127.0.0.1" + path, init)
const json = async <T>(response: Response): Promise<T> => (await response.json()) as T

test("ai-gateway plugin proxies /health and /v1/*", async () => {
  const host = makePluginHost()
  const send = async () =>
    new Response(JSON.stringify({ id: "cmpl-1", object: "chat.completion" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  await host.register(makeAiGatewayEffectPlugin({ send, getConfig: () => ({ providers: [{ id: "test-upstream", apiType: "openai.chat", baseURL: "https://test-upstream.invalid" }] }) }))

  const health = await host.handle(req("/health"))
  expect((await json<{ ok: boolean }>(health)).ok).toBe(true)

  const proxied = await host.handle(
    req("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] }),
    }),
  )
  expect(proxied.status).toBe(200)
  expect((await json<{ object: string }>(proxied)).object).toBe("chat.completion")
  await host.close()
})

test("board plugin serves the real board web surface", async () => {
  const host = makePluginHost()
  await host.register(createBoardPlugin(() => ({ dataFile: ":memory:" })))

  const health = await host.handle(req("/board/api/health"))
  expect((await json<{ ok: boolean }>(health)).ok).toBe(true)
  const state = await host.handle(req("/board/api/state"))
  expect(state.status).toBe(200)
  const root = await host.handle(req("/board/"))
  expect(root.headers.get("content-type")?.split(";")[0]).toBe("text/html")
  await host.close()
})

test("ui-host plugin is lazy: disabled then hot-enabled under /ui", async () => {
  const host = makePluginHost({ control: true })
  let starts = 0
  const plugin = createUiHostPlugin(() => ({}), { fetch }, () => {
    starts++
    return { handle: async (request: Request) => Response.json({ path: new URL(request.url).pathname }), close: () => {} }
  })
  await host.register({ ...plugin, routes: [{ path: "/ui", match: "prefix" }], enabled: false })
  expect(starts).toBe(0)
  expect(host.isEnabled("ui-host")).toBe(false)
  expect((await host.handle(req("/ui/api/canvas"))).status).toBe(404)

  await host.handle(req("/-/planes/ui-host/enable", { method: "POST" }))
  const canvas = await host.handle(req("/ui/api/canvas"))
  expect(canvas.status).toBe(200)
  expect(await canvas.json()).toEqual({ path: "/api/canvas" })
  expect(starts).toBe(1)
  await host.close()
})
