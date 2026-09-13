import { expect, test } from "bun:test"

import { asResource, makeAuthz } from "../src/index.ts"

const bob = { kind: "user", id: "bob" } as const

test("require throws with the principal, the action and the resource", () => {
  const authz = makeAuthz()
  expect(() => authz.require(bob, "call", asResource("ops::board.danger")))
    .toThrow("effect-authz: denied — user:bob cannot call ops::board.danger (default deny)")
})

test("require is silent when the decision allows", () => {
  const authz = makeAuthz()
  expect(() => authz.require(bob, "read", asResource("bob::board"))).not.toThrow()
})

test("grant then revoke is symmetric and reports how much it removed", () => {
  const authz = makeAuthz()
  const before = authz.view(bob).length
  authz.grant({ subject: "user:bob", resource: "ops::board", actions: ["call"] })
  expect(authz.view(bob).length).toBe(before + 1)
  expect(authz.revoke("user:bob", "ops::board")).toBe(1)
  expect(authz.view(bob).length).toBe(before)
  expect(authz.revoke("user:bob", "ops::board")).toBe(0)
})

test("revoke can be narrowed to specific actions", () => {
  const authz = makeAuthz()
  authz.grant({ subject: "user:bob", resource: "ops::board", actions: ["call"] })
  authz.grant({ subject: "user:bob", resource: "ops::deck", actions: ["write"] })
  expect(authz.revoke("user:bob", "ops::deck", ["read"])).toBe(0)
  expect(authz.revoke("user:bob", "ops::deck", ["write"])).toBe(1)
  expect(authz.view(bob).map((entry) => entry.resource.raw)).toContain("ops::board")
})

test("a snapshot replays into an equivalent engine", () => {
  const first = makeAuthz()
  first.grant({ subject: "user:bob", resource: "ops::board", actions: ["call"], source: "manifest" })
  first.grant({ subject: "user:bob", resource: "ops::board.danger", actions: ["call"], effect: "deny", source: "operator" })
  const second = makeAuthz(first.snapshot())
  for (const raw of ["ops::board.view", "ops::board.danger", "bob::board", "ops::deck"]) {
    expect(second.decide(bob, "call", asResource(raw))).toEqual(first.decide(bob, "call", asResource(raw)))
  }
})

test("setTemplate replaces one kind without touching the others", () => {
  const authz = makeAuthz()
  const system = { kind: "system", id: "svc" } as const
  authz.setTemplate("user", [{ subject: "*", resource: asResource("**"), actions: ["read"], effect: "deny", source: "operator" }])
  expect(authz.decide(bob, "read", asResource("bob::board")).allowed).toBe(false)
  expect(authz.decide(system, "read", asResource("ops::board")).allowed).toBe(true)
})
