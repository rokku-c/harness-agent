import { expect, test } from "bun:test"
import { identityFromHeaders, redactArgs } from "../src/index.ts"
import { make } from "./fixtures.ts"

test("audit scrubs secrets and does not store raw args", async () => {
  const { events, gateway } = make(undefined, undefined, { captureArgs: true })
  await gateway.handle({ callId: "rf-6", serverId: "files", tool: "read", args: { apiKey: "secret", nested: { token: "token", keep: 1 } } })
  expect(events.find((event) => event.type === "response")?.argsRedacted).toEqual({ apiKey: "[REDACTED]", nested: { token: "[REDACTED]", keep: 1 } })
  expect(JSON.stringify(events)).not.toContain("secret")
})
test("redaction and identity normalize case without leaking values", () => {
  expect(redactArgs({ Authorization: "Bearer x", api_key: "k", ok: [1, 2] })).toEqual({ Authorization: "[REDACTED]", api_key: "[REDACTED]", ok: [1, 2] })
  expect(identityFromHeaders({ "x-agent-id": "a", "X-Session-Id": "s", "x-request-id": ["r", "old"] })).toEqual({ agent: "a", session: "s", requestId: "r" })
})
