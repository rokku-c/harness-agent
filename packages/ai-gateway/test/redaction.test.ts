import { expect, test } from "bun:test"
import { makeAiGateway, redact, safeHeaders, type GatewayEvent } from "../src/index.ts"

test("audit strips provider/client credential headers including x-api-key and cookies", async () => {
  const headers = new Headers({ authorization: "Bearer test-only", "x-api-key": "test-only",
    "proxy-authorization": "test-only", cookie: "session=test-only", "x-access-token": "test-only", "x-request-id": "r1" })
  expect(safeHeaders(headers)).toEqual({ "x-request-id": "r1" })
  const events: GatewayEvent[] = []
  const gateway = makeAiGateway({ recorder: { record: (event) => { events.push(event) } },
    upstream: { send: async () => Response.json({}) },
  })
  await gateway.handle(new Request("http://gateway.test/v1/messages", { method: "POST", headers, body: "{}" }),
    { requestId: "r1", path: "/v1/messages" })
  expect(events[0].detail.headers).toEqual({ "x-request-id": "r1" })
})

test("captured nested credentials are redacted without changing ordinary content", () => {
  expect(redact({ messages: [{ content: "hello", apiKey: "test-only" }], api_key: "test-only" })).toEqual({
    messages: [{ content: "hello", apiKey: "[REDACTED]" }], api_key: "[REDACTED]",
  })
})
