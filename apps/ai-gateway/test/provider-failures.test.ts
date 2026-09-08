import { expect, test } from "bun:test"
import { makeAiGatewayHandler } from "../src/handler.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

const configured = [providers[0], { ...providers[0], id: "second", baseURL: "https://second.test" }]

test("upstream HTTP failures and transport exceptions never retry or fall back", async () => {
  for (const selected of [false, true]) {
    for (const throws of [false, true]) {
      const upstream = Response.json({ error: "rate limit" }, { status: 429, headers: { "retry-after": "2" } })
      const stub = stubFetch(() => {
        if (throws) throw new Error("connection interrupted")
        return upstream
      })
      const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: configured }), send: stub.send })
      const response = await handle(request(paths[0], {}, selected ? { "x-upstream-id": "chat" } : undefined))
      expect(response.status).toBe(throws ? 502 : 429)
      if (throws) expect(await response.json()).toEqual({ error: { type: "gateway_error", message: "connection interrupted" } })
      else expect(response).toBe(upstream)
      expect(stub.requests.map(input => new URL(input.url).hostname)).toEqual(["chat.example.test"])
    }
  }
})
