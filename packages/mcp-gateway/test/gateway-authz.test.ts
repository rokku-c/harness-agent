import { expect, test } from "bun:test"

import { makeAuthz, principalKey, type Principal } from "@effect-agent/effect-authz"

import { make } from "./fixtures.ts"

const alice: Principal = { kind: "user", id: "alice" }
const grantFor = (subject: string, resource: string) => {
  const authz = makeAuthz()
  authz.grant({ subject, resource, actions: ["call"] })
  return authz
}

test("with authz configured, an unresolved caller is refused before upstream", async () => {
  let called = false
  const { events, gateway } = make(undefined, { call: async () => { called = true; return { status: 200, ok: true, durationMs: 0 } } }, { authz: makeAuthz() })
  const result = await gateway.handle({ callId: "az-1", serverId: "board", tool: "board_view" })
  expect(result).toMatchObject({ ok: false, status: 403, detail: "no_principal" })
  expect(called).toBe(false)
  expect(events.at(-1)?.detail).toBe("no_principal")
})

test("a resolved caller without a grant is refused before upstream", async () => {
  let called = false
  const { events, gateway } = make(undefined, { call: async () => { called = true; return { status: 200, ok: true, durationMs: 0 } } }, { authz: makeAuthz() })
  const result = await gateway.handle({ callId: "az-2", principal: alice, serverId: "board", tool: "board_view" })
  expect(result).toMatchObject({ ok: false, status: 403, detail: "denied_by_principal" })
  expect(called).toBe(false)
  expect(events.map((event) => event.type)).toEqual(["call", "authz", "error"])
})

test("a granted caller reaches upstream and is audited under its own principal", async () => {
  const authz = grantFor(principalKey(alice), "mcp://board/**")
  const { events, gateway } = make(undefined, undefined, { authz })
  const result = await gateway.handle({ callId: "az-3", principal: alice, serverId: "board", tool: "board_view" })
  expect(result).toMatchObject({ ok: true, status: 200 })
  expect(events.map((event) => event.type)).toEqual(["call", "authz", "response"])
  expect(events.every((event) => event.principal === "user:alice")).toBe(true)
  expect(events[1]!.decision).toBe("allow")
})

test("a rule deny still wins over an authz allow", async () => {
  const authz = grantFor(principalKey(alice), "mcp://board/**")
  const rules = [{ ruleId: "freeze", match: { serverId: "board" }, action: "deny" as const }]
  const { gateway } = make(rules, undefined, { authz })
  const result = await gateway.handle({ callId: "az-4", principal: alice, serverId: "board", tool: "board_view" })
  expect(result).toMatchObject({ ok: false, status: 403, detail: "denied_by_rule", ruleId: "freeze" })
})

test("one principal's grant does not carry to the next request", async () => {
  const authz = grantFor("user:bob", "mcp://board/**")
  const { gateway } = make(undefined, undefined, { authz })
  const allowed = await gateway.handle({ callId: "az-5", principal: { kind: "user", id: "bob" }, serverId: "board", tool: "board_view" })
  const refused = await gateway.handle({ callId: "az-6", principal: alice, serverId: "board", tool: "board_view" })
  expect(allowed.ok).toBe(true)
  expect(refused).toMatchObject({ ok: false, detail: "denied_by_principal" })
})

test("revoking a grant closes the call again without touching the rules", async () => {
  const key = principalKey(alice)
  const authz = grantFor(key, "mcp://board/**")
  const { gateway } = make(undefined, undefined, { authz })
  const before = await gateway.handle({ callId: "az-7", principal: alice, serverId: "board", tool: "board_view" })
  expect(authz.revoke(key, "mcp://board/**")).toBe(1)
  const after = await gateway.handle({ callId: "az-8", principal: alice, serverId: "board", tool: "board_view" })
  expect(before.ok).toBe(true)
  expect(after).toMatchObject({ ok: false, detail: "denied_by_principal" })
})
