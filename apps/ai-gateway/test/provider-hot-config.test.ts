import { expect, test } from "bun:test"
import { makeAiGatewayHandler } from "../src/handler.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

const [a, b, c, d] = ["a", "b", "c", "d"].map(id => ({ ...providers[0], id, baseURL: `https://${id}.test` }))

test("hot add/remove/reorder keeps the next surviving ID and uses current URL/key", async () => {
  let configured = [a, b, c]
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: configured }), send: stub.send })
  const call = () => handle(request(paths[0]))
  await call() // a; next b
  configured = [{ ...a, baseURL: "https://a-new.test", apiKey: "rotated" }, c, d]
  await call(); await call(); await call() // removed b => c, d, a (updated)
  configured = [d, b, a, c]
  await call(); await call(); await call() // next c survives reorder => c, d, b
  configured = [d, c]
  await call() // next a removed => c
  expect(stub.requests.map(input => new URL(input.url).hostname)).toEqual([
    "a.test", "c.test", "d.test", "a-new.test", "c.test", "d.test", "b.test", "c.test",
  ])
  expect(stub.requests[3].headers.get("authorization")).toBe("Bearer rotated")
  const removed = await handle(request(paths[0], {}, { "x-upstream-id": "b" }))
  expect(removed.status).toBe(404)
  expect(stub.requests.length).toBe(8)
})

test("enable/type changes and empty/full replacement rebuild rings without stale entries", async () => {
  let configured = [a, b, c]
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: configured }), send: stub.send })
  const call = () => handle(request(paths[0]))
  await call()
  configured = [a, { ...b, enabled: false }, c]
  await call() // disabled b => c
  configured = [a, { ...b, apiType: "openai.responses" }, c]
  await call() // a
  expect((await handle(request(paths[0], {}, { "x-upstream-id": "b" }))).status).toBe(400)
  await handle(request(paths[1])) // b moved to responses
  configured = []
  expect((await call()).status).toBe(503)
  configured = [d, b]
  await call(); await call()
  expect(stub.requests.map(input => new URL(input.url).hostname)).toEqual([
    "a.test", "c.test", "a.test", "b.test", "d.test", "b.test",
  ])
})

test("credential-only and unrelated config changes keep the cursor, including in-place edits", async () => {
  const configured = [structuredClone(a), structuredClone(b)]
  const active = { providers: configured, captureBodies: false }
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => active, send: stub.send })
  await handle(request(paths[0]))
  configured[1].apiKey = "rotated"
  active.captureBodies = true
  await handle(request(paths[0]))
  configured[0].baseURL = "https://a-changed.test"
  await handle(request(paths[0]))
  expect(stub.requests.map(input => new URL(input.url).hostname)).toEqual(["a.test", "b.test", "a-changed.test"])
  expect(stub.requests[1].headers.get("authorization")).toBe("Bearer rotated")
})
