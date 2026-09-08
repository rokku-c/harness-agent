import { expect, test } from "bun:test"
import { makeAiGatewayEffectPlugin } from "../src/effect-plugin.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

test("three exact paths select independent URLs and authentication, never the model", async () => {
  const stub = stubFetch()
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => ({ providers }), send: stub.send }).load()
  const expected = [
    "https://chat.example.test/proxy/v1/chat/completions?q=a%2Fb&q=2",
    "https://responses.example.test/prefix/v1/responses?q=a%2Fb&q=2",
    "https://messages.example.test/v1/messages?q=a%2Fb&q=2",
  ]
  for (const [index, path] of paths.entries()) {
    expect((await plane.handle(request(`${path}?q=a%2Fb&q=2`))).status).toBe(200)
    const outgoing = stub.requests[index]
    expect(outgoing.url).toBe(expected[index])
    expect(outgoing.method).toBe("POST")
    expect(await outgoing.json()).toEqual({ model: "same-model", stream: true })
    expect(outgoing.headers.get("authorization")).toBe(index < 2 ? `Bearer ${providers[index].apiKey}` : null)
    expect(outgoing.headers.get("x-api-key")).toBe(index === 2 ? "messages-key" : null)
    expect(outgoing.headers.get("anthropic-version")).toBe(index === 2 ? "2023-06-01" : null)
  }
})

test("missing apiTypes return explicit 503 even when another type is configured", async () => {
  const stub = stubFetch()
  for (const [index, path] of paths.entries()) {
    for (const configured of [[], providers.filter((_, i) => i !== index)]) {
      const plane = await makeAiGatewayEffectPlugin({ getConfig: () => ({ providers: configured }), send: stub.send }).load()
      const response = await plane.handle(request(path))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: { type: "provider_not_configured",
        message: `ai-gateway: no enabled provider configured for ${providers[index].apiType} (${path})`,
      } })
    }
  }
  expect(stub.requests).toEqual([])
})

test("unknown and near-match paths and non-POST methods never forward", async () => {
  const stub = stubFetch()
  const plane = await makeAiGatewayEffectPlugin({ getConfig: () => ({ providers }), send: stub.send }).load()
  for (const path of ["/v1", "/v1/", "/v1/models", "/v1/messages/count_tokens", "/v1/messages-extra", "/v1/responses/1", "/v1/chat/completions/"]) {
    expect((await plane.handle(request(path))).status).toBe(404)
  }
  for (const method of ["GET", "PUT", "DELETE"]) {
    expect((await plane.handle(new Request("http://gateway.test/v1/responses", { method }))).status).toBe(404)
  }
  expect(stub.requests).toEqual([])
})
