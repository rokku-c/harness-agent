import { expect, test } from "bun:test"
import { makeAiGatewayHandler } from "../src/handler.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

const inbound = {
  authorization: "Bearer client-secret", "proxy-authorization": "Basic client-secret",
  "x-api-key": "client-secret", "api-key": "client-secret", "x-goog-api-key": "client-secret",
  "x-auth-token": "client-secret", "cookie": "session=client-secret",
  "x-agent-id": "internal-agent", "x-session-id": "internal-session", "x-user-id": "internal-user",
  "x-effect-identity": "internal-effect", "x-identity": "internal-identity",
  "anthropic-version": "1900-01-01", "openai-organization": "client-org", "openai-project": "client-project",
  "x-request-id": "trace-id", "anthropic-beta": "test-beta", "content-type": "application/json",
}

test("incoming credentials and identity are stripped before provider-owned auth is applied", async () => {
  for (const haveKeys of [true, false]) {
    const stub = stubFetch()
    const configured = providers.map(({ apiKey, ...provider }) => haveKeys ? { ...provider, apiKey } : provider)
    const handle = makeAiGatewayHandler({ getConfig: () => ({ providers: configured }), send: stub.send })
    for (const [index, path] of paths.entries()) {
      expect((await handle(request(path, {}, inbound))).status).toBe(200)
      const headers = stub.requests[index].headers
      for (const name of Object.keys(inbound)) {
        if (["authorization", "x-api-key", "anthropic-version", "x-request-id", "anthropic-beta", "content-type"].includes(name)) continue
        expect(headers.get(name)).toBeNull()
      }
      expect(headers.get("authorization")).toBe(haveKeys && index < 2 ? `Bearer ${providers[index].apiKey}` : null)
      expect(headers.get("x-api-key")).toBe(haveKeys && index === 2 ? "messages-key" : null)
      expect(headers.get("anthropic-version")).toBe(index === 2 ? "2023-06-01" : null)
      expect(headers.get("x-request-id")).toBe("trace-id")
      expect(headers.get("anthropic-beta")).toBe("test-beta")
      expect(headers.get("content-type")).toBe("application/json")
      expect(stub.requests[index].redirect).toBe("manual")
    }
  }
})

test("connection-nominated headers cannot override sanitized upstream credentials", async () => {
  const stub = stubFetch()
  const handle = makeAiGatewayHandler({ getConfig: () => ({ providers }), send: stub.send })
  await handle(request(paths[0], {}, { connection: "x-private, authorization", "x-private": "internal" }))
  expect(stub.requests[0].headers.get("connection")).toBeNull()
  expect(stub.requests[0].headers.get("x-private")).toBeNull()
  expect(stub.requests[0].headers.get("authorization")).toBe("Bearer chat-key")
})
