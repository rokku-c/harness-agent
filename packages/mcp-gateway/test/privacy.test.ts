import { expect, test } from "bun:test"
import { identityFromRequest, redactArgs } from "../src/index.ts"
import { make } from "./fixtures.ts"

test("audit scrubs secrets and does not store raw args", async () => {
  const { events, gateway } = make(undefined, undefined, { captureArgs: true })
  await gateway.handle({ callId: "rf-6", serverId: "files", tool: "read", args: { apiKey: "secret", nested: { token: "token", keep: 1 } } })
  expect(events.find((event) => event.type === "response")?.argsRedacted).toEqual({ apiKey: "[REDACTED]", nested: { token: "[REDACTED]", keep: 1 } })
  expect(JSON.stringify(events)).not.toContain("secret")
})
test("redaction and identity normalize case without leaking values", () => {
  expect(redactArgs({ Authorization: "Bearer x", api_key: "k", ok: [1, 2] })).toEqual({ Authorization: "[REDACTED]", api_key: "[REDACTED]", ok: [1, 2] })
  // case-insensitive on the header bag, and `x-agent-id` is not read at all: a
  // caller writes its own headers, so nothing here may name the caller.
  const headers = { "x-agent-id": "a", "X-Session-Id": "s", "x-request-id": ["r", "old"] }
  expect(identityFromRequest({ headers })).toEqual({ session: "s", requestId: "r" })
  expect(identityFromRequest({ headers, authInfo: { clientId: "cli", extra: { sessionId: "verified" } } }))
    .toEqual({ session: "verified", requestId: "r" })
})
