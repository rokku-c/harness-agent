import { expect, test } from "bun:test"

import { asResource, makeAuthz, type AuthzEvent, type AuthzRecorder } from "../src/index.ts"

const collect = (): { events: AuthzEvent[]; recorder: AuthzRecorder } => {
  const events: AuthzEvent[] = []
  return { events, recorder: { record: (event) => { events.push(event) } } }
}

const alice = { kind: "user", id: "alice" } as const
const bob = { kind: "user", id: "bob" } as const

test("every decision emits one event, denials included", () => {
  const { events, recorder } = collect()
  const authz = makeAuthz({ recorder, now: () => 42 })
  authz.decide(alice, "read", asResource("alice::board"))
  authz.decide(bob, "call", asResource("ops::board.danger"))
  expect(events).toHaveLength(2)
  expect(events[0]).toEqual({
    at: 42,
    principalKey: "user:alice",
    kind: "user",
    action: "read",
    resource: "alice::board",
    allowed: true,
    reason: "explicit allow",
    source: "template",
  })
  expect(events[1].allowed).toBe(false)
  expect(events[1].reason).toBe("default deny")
  expect(events[1].source).toBeUndefined()
})

test("require records exactly once", () => {
  const { events, recorder } = collect()
  const authz = makeAuthz({ recorder })
  expect(() => authz.require(bob, "call", asResource("ops::board.danger"))).toThrow()
  expect(events).toHaveLength(1)
  expect(events[0].principalKey).toBe("user:bob")
})

test("the projection records nothing", () => {
  const { events, recorder } = collect()
  const authz = makeAuthz({ recorder })
  authz.visible(alice, "read", ["alice", "bob", "ops"].map(asResource))
  expect(events).toHaveLength(0)
})
