import { expect, test } from "bun:test"
import { makeAiGatewayEffectPlugin } from "../src/effect-plugin.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

test("each request uses one active snapshot; saved edits alone do not change routing", async () => {
  let active: unknown = { providers: [providers[0]] }
  let reads = 0
  const stub = stubFetch()
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => { reads++; return active }, send: stub.send }).load()
  expect(reads).toBe(0)
  await plane.handle(request(paths[0]))
  const saved = { providers: [{ ...providers[0], baseURL: "https://new.test/v1", apiKey: "new-key" }] }
  await plane.handle(request(paths[0]))
  expect(stub.requests.map((r) => r.url)).toEqual(Array(2).fill("https://chat.example.test/proxy/v1/chat/completions"))
  active = saved
  await plane.handle(request(paths[0]))
  expect(stub.requests[2].url).toBe("https://new.test/v1/chat/completions")
  expect(stub.requests[2].headers.get("authorization")).toBe("Bearer new-key")
  active = { providers: [] }
  expect((await plane.handle(request(paths[0]))).status).toBe(503)
  expect(stub.requests.length).toBe(3)
  expect(reads).toBe(4)
})

test("invalid active configuration fails closed instead of using a previous provider", async () => {
  let active: unknown = { providers }
  const stub = stubFetch()
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => active, send: stub.send }).load()
  await plane.handle(request(paths[0]))
  for (const invalid of [{ providers: [providers[0], providers[0]] }, { providers: [{ ...providers[0], baseURL: "" }] }, null]) {
    active = invalid
    const response = await plane.handle(request(paths[0]))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: { type: "config_error" } })
  }
  expect(stub.requests.length).toBe(1)
})

test("config reader failure also fails closed", async () => {
  const stub = stubFetch()
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => { throw new Error("active unavailable") }, send: stub.send }).load()
  const response = await plane.handle(request(paths[1]))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: { type: "config_error", message: "ai-gateway: invalid active config: active unavailable" } })
  expect(stub.requests).toEqual([])
})
