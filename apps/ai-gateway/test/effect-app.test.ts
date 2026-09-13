import { expect, test } from "bun:test"
import { effectApp } from "../src/effect-app.ts"
import { makeAiGatewayEffectPlugin } from "../src/effect-plugin.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

test("app declares bounded platform routes and uses exactly its context egress fetch", async () => {
  const stub = stubFetch()
  let active = { providers }
  const plugin = effectApp.createPlugin!(() => active, { fetch: stub.send })
  expect(effectApp.egress).toBe("main-first")
  expect(effectApp.path).toBe("/models")
  expect(effectApp.routes).toEqual([{ path: "/health", match: "exact" }, { path: "/models", match: "prefix" }, { path: "/v1", match: "prefix" }])
  const plane = await plugin.load()
  expect((await plane.handle(request("/health"))).status).toBe(200)
  const models = await plane.handle(new Request("http://gateway.test/models"))
  const modelState = await models.json() as { providers: Array<{ id: string; credential: string }>; endpoints: string[] }
  expect(modelState.providers[0]).toMatchObject({ id: "chat", credential: "configured" })
  expect(modelState.endpoints).toEqual(["/v1/chat/completions", "/v1/responses", "/v1/messages"])
  const html = await plane.handle(new Request("http://host/models", { headers: { accept: "text/html" } }))
  expect(html.headers.get("content-type")).toBe("application/json;charset=utf-8")
  expect(stub.requests).toEqual([])
  expect((await plane.handle(request(paths[0], {}, { "x-upstream-id": "chat" }))).status).toBe(200)
  expect(stub.requests[0].url).toBe("https://chat.example.test/proxy/v1/chat/completions")
  expect(stub.requests[0].headers.get("x-upstream-id")).toBeNull()
  active = { providers: [] }
  expect((await plane.handle(request(paths[0]))).status).toBe(503)
  expect(stub.requests.length).toBe(1)
})

test("models exposes usage derived from the recorded gateway audit", async () => {
  const stub = stubFetch()
  const plugin = makeAiGatewayEffectPlugin({ getConfig: () => ({ providers }), send: stub.send, database: ":memory:" })
  const plane = await plugin.load()
  try {
    expect((await plane.handle(request(paths[0], {}, { "x-upstream-id": "chat" }))).status).toBe(200)
    const state = await (await plane.handle(new Request("http://gateway.test/models"))).json() as { usage: { requests: number; responses: number; averageDurationMs: number | null; recent: Array<{ requestId: string; status?: number; durationMs?: number }> } }
    expect(state.usage.responses).toBe(1)
    expect(state.usage.requests).toBe(1)
    expect(state.usage.averageDurationMs).not.toBeNull()
    // one exchange, not two events: the request and its response are one row
    expect(state.usage.recent).toHaveLength(1)
    expect(state.usage.recent[0]?.status).toBe(200)
    expect(state.usage.recent[0]?.durationMs).toBeGreaterThanOrEqual(0)
    const events = await (await plane.handle(new Request("http://gateway.test/models/events"))).json() as { events: Array<{ type: string }> }
    expect(events.events[0]?.type).toBe("response")
  } finally { await plane.stop?.() }
})

test("models tests a provider through the same platform egress the proxy uses", async () => {
  const stub = stubFetch(() => new Response(null, { status: 204 }))
  const plugin = makeAiGatewayEffectPlugin({ getConfig: () => ({ providers: [providers[0]] }), send: stub.send, database: ":memory:" })
  const plane = await plugin.load()
  try {
    const healthy = await (await plane.handle(new Request("http://gateway.test/models/providers/chat/test", { method: "POST" }))).json() as { health: { reachable: boolean; status: number } }
    expect(healthy.health).toMatchObject({ providerId: "chat", reachable: true, status: 204 })
    expect(stub.requests[0].headers.get("authorization")).toBe("Bearer chat-key")
    expect((await plane.handle(new Request("http://gateway.test/models/providers/nope/test", { method: "POST" }))).status).toBe(404)
  } finally { await plane.stop?.() }
})
