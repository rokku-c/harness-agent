import { expect, test } from "bun:test"
import { effectApp } from "../src/effect-app.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

test("app declares bounded platform routes and uses exactly its context egress fetch", async () => {
  const stub = stubFetch()
  let active = { providers }
  const plugin = effectApp.createPlugin!(() => active, { fetch: stub.send })
  expect(effectApp.egress).toBe("main-first")
  expect(effectApp.routes).toEqual([{ path: "/health", match: "exact" }, { path: "/v1", match: "prefix" }])
  const plane = await plugin.load()
  expect((await plane.handle(request("/health"))).status).toBe(200)
  expect(stub.requests).toEqual([])
  expect((await plane.handle(request(paths[0], {}, { "x-upstream-id": "chat" }))).status).toBe(200)
  expect(stub.requests[0].url).toBe("https://chat.example.test/proxy/v1/chat/completions")
  expect(stub.requests[0].headers.get("x-upstream-id")).toBeNull()
  active = { providers: [] }
  expect((await plane.handle(request(paths[0]))).status).toBe(503)
  expect(stub.requests.length).toBe(1)
})
