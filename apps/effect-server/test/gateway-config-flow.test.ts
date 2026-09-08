import { expect, test } from "bun:test"
import { gatewayFixture, chat } from "./gateway-fixture.ts"

const config = "/console/api/config/ai-gateway"
test("real config Save/apply/restart changes routing without environment fallback", async () => {
  const app = await gatewayFixture()
  try {
    expect(await (await app.request("/v1/chat/completions", chat)).json()).toEqual({ path: "/first/v1/chat/completions" })
    const providers = [{ id: "chat-secondary", apiType: "openai.chat", baseURL: app.upstream.url.origin + "/second/v1", apiKey: "second-key" }]
    const saved = await app.request(config, { override: { providers }, strategy: "restart" })
    expect(saved.status).toBe(200)
    expect((await saved.json()).pendingRestart).toBe(true)
    expect(await (await app.request("/v1/chat/completions", chat)).json()).toEqual({ path: "/first/v1/chat/completions" })
    expect((await (await app.request(config + "/apply", {})).json()).pendingRestart).toBe(false)
    expect(await (await app.request("/v1/chat/completions", chat)).json()).toEqual({ path: "/second/v1/chat/completions" })
    expect(app.received.at(-1)?.auth).toBe("Bearer second-key")
    expect((await app.request("/v1/responses", { model: "stub", input: "hi" })).status).toBe(503)
    const immediate = await app.request(config, { override: { providers: [] }, strategy: "apply" })
    expect(immediate.status).toBe(200)
    expect((await app.request("/v1/chat/completions", chat)).status).toBe(503)
    await app.restart()
    expect((await app.request("/v1/chat/completions", chat)).status).toBe(503)
    expect((await (await app.request(config)).json()).value.providers).toEqual([])
  } finally { await app.close() }
})
test("invalid provider save leaves persisted and live routing unchanged", async () => {
  const app = await gatewayFixture()
  try {
    const before = await (await app.request(config)).json()
    const failed = await app.request(config, { override: { providers: [{ apiType: "openai.chat" }] }, strategy: "apply" })
    expect(failed.status).toBe(400)
    const after = await (await app.request(config)).json()
    expect(after.value).toEqual(before.value)
    expect(after.revision).toBe(before.revision)
    expect(await (await app.request("/v1/chat/completions", chat)).json()).toEqual({ path: "/first/v1/chat/completions" })
  } finally { await app.close() }
})
