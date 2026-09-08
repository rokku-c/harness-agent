import { expect, test } from "bun:test"
import { identityFromHeaders, redactArgs } from "../src/index.ts"

test("audit redaction removes nested secrets", () => {
  expect(redactArgs({ path: "/tmp/a", apiKey: "secret", nested: { token: "t", keep: 1 } })).toEqual({ path: "/tmp/a", apiKey: "[REDACTED]", nested: { token: "[REDACTED]", keep: 1 } })
  expect(redactArgs(undefined)).toBeUndefined()
})

test("redaction is case insensitive", () => {
  expect(redactArgs({ Authorization: "Bearer x", ok: [1, 2] })).toEqual({ Authorization: "[REDACTED]", ok: [1, 2] })
})

test("identity reads standard x-* headers", () => {
  expect(identityFromHeaders({ "x-agent-id": "builder-2", "X-Session-Id": "s1", "x-request-id": ["r1", "r2"] })).toEqual({ agent: "builder-2", session: "s1", requestId: "r1" })
})
