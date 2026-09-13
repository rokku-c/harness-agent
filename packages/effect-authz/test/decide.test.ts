import { expect, test } from "bun:test"

import { asResource, makeAuthz, resolveDecision, type PolicyEntry } from "../src/index.ts"

const alice = { kind: "user", id: "alice" } as const
const bob = { kind: "user", id: "bob" } as const
const system = { kind: "system", id: "codex-sync" } as const

const entry = (over: Partial<PolicyEntry>): PolicyEntry => ({
  subject: "user:bob",
  resource: asResource("ops::board"),
  actions: ["call"],
  effect: "allow",
  source: "consent",
  ...over,
})

test("nothing matches, so the default is deny", () => {
  const decision = resolveDecision([], "user:bob", "call", asResource("ops::board"))
  expect(decision).toEqual({ allowed: false, effect: "default", reason: "default deny" })
  expect(decision.matchedBy).toBeUndefined()
})

test("the kind template gives a user its own namespace", () => {
  const authz = makeAuthz()
  expect(authz.decide(alice, "read", asResource("alice")).allowed).toBe(true)
  expect(authz.decide(alice, "read", asResource("alice::board")).allowed).toBe(true)
  expect(authz.decide(alice, "read", asResource("bob")).allowed).toBe(false)
})

test("a system principal reaches the gateway surface, a user does not", () => {
  const authz = makeAuthz()
  expect(authz.decide(system, "call", asResource("mcp://github/create_issue")).allowed).toBe(true)
  expect(authz.decide(alice, "call", asResource("mcp://github/create_issue")).allowed).toBe(false)
})

test("a grant adds exactly the actions it lists", () => {
  const authz = makeAuthz()
  authz.grant({ subject: "user:bob", resource: "ops::board", actions: ["call"], source: "manifest" })
  const granted = authz.decide(bob, "call", asResource("ops::board.view"))
  expect(granted.allowed).toBe(true)
  expect(granted.matchedBy?.source).toBe("manifest")
  expect(authz.decide(bob, "write", asResource("ops::board.view")).allowed).toBe(false)
})

test("revoke returns the count and restores the default", () => {
  const authz = makeAuthz()
  authz.grant({ subject: "user:bob", resource: "ops::board", actions: ["call"] })
  expect(authz.decide(bob, "call", asResource("ops::board.view")).allowed).toBe(true)
  expect(authz.revoke("user:bob", "ops::board")).toBe(1)
  expect(authz.decide(bob, "call", asResource("ops::board.view")).allowed).toBe(false)
})

test("deny overrides an allow regardless of insertion order", () => {
  const orders = [true, false].map((denyFirst) => {
    const allow = entry({ resource: asResource("ops::board.*") })
    const deny = entry({ effect: "deny", resource: asResource("ops::board.danger") })
    return denyFirst ? [deny, allow] : [allow, deny]
  })
  for (const entries of orders) {
    const danger = resolveDecision(entries, "user:bob", "call", asResource("ops::board.danger"))
    expect(danger.allowed).toBe(false)
    expect(danger.reason).toBe("explicit deny")
    expect(danger.matchedBy?.effect).toBe("deny")
    expect(resolveDecision(entries, "user:bob", "call", asResource("ops::board.view")).allowed).toBe(true)
  }
})

test("an explicit deny outranks a template grant", () => {
  const authz = makeAuthz()
  expect(authz.decide(alice, "read", asResource("alice::board")).allowed).toBe(true)
  authz.grant({ subject: "user:alice", resource: "alice::board", actions: ["read"], effect: "deny", source: "operator" })
  const decided = authz.decide(alice, "read", asResource("alice::board"))
  expect(decided.allowed).toBe(false)
  expect(decided.reason).toBe("explicit deny")
  expect(decided.matchedBy?.source).toBe("operator")
})
