import { expect, test } from "bun:test"

import { asResource, makeAuthz } from "../src/index.ts"

const alice = { kind: "user", id: "alice" } as const

test("the projection keeps only what the principal may use, in order", () => {
  const authz = makeAuthz()
  const candidates = ["alice", "alice::board", "bob", "mcp://github/create_issue"].map(asResource)
  expect(authz.visible(alice, "read", candidates).map((resource) => resource.raw))
    .toEqual(["alice", "alice::board"])
})

test("a projection that loses a candidate to a deny is the same decision", () => {
  const authz = makeAuthz()
  authz.grant({ subject: "user:alice", resource: "ops::board.view", actions: ["read"] })
  authz.grant({ subject: "user:alice", resource: "ops::board.danger", actions: ["read"], effect: "deny" })
  const pool = ["ops::board.view", "ops::board.danger", "ops::board.edit", "alice::board"].map(asResource)
  const visible = authz.visible(alice, "read", pool)
  expect(visible.map((resource) => resource.raw)).toEqual(["ops::board.view", "alice::board"])
  for (const resource of pool) {
    expect(visible.includes(resource)).toBe(authz.decide(alice, "read", resource).allowed)
  }
})

test("a tool missing from the projection is not callable", () => {
  const authz = makeAuthz()
  const tool = asResource("mcp://github/create_issue")
  expect(authz.visible(alice, "call", [tool])).toEqual([])
  expect(authz.decide(alice, "call", tool).allowed).toBe(false)
})
