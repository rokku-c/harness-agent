import { expect, test } from "bun:test"

import { makePrincipalRegistry } from "../src/index.ts"

test("registering makes a principal active and reachable by key", () => {
  const registry = makePrincipalRegistry()
  const record = registry.register({ kind: "user", id: "alice", displayName: "Alice" })
  expect(record.status).toBe("active")
  expect(record.displayName).toBe("Alice")
  expect(registry.get("user:alice")).toEqual(record)
  expect(registry.active("user:alice")).toBe(true)
})

test("the three kinds share one key space", () => {
  const registry = makePrincipalRegistry()
  registry.register({ kind: "user", id: "sync" })
  registry.register({ kind: "app", id: "sync" })
  registry.register({ kind: "system", id: "sync" })
  expect(registry.list().map((record) => record.kind)).toEqual(["user", "app", "system"])
})

test("re-registering preserves the creation time and re-activates", () => {
  const registry = makePrincipalRegistry({ now: () => 1_000 })
  const first = registry.register({ kind: "user", id: "alice" })
  registry.setStatus("user:alice", "disabled")
  const second = registry.register({ kind: "user", id: "alice", displayName: "Alice" })
  expect(second.createdAt).toBe(first.createdAt)
  expect(second.status).toBe("active")
  expect(registry.list()).toHaveLength(1)
})

test("disabling leaves the identity in place but inactive", () => {
  const registry = makePrincipalRegistry()
  registry.register({ kind: "app", id: "billing-sync" })
  expect(registry.setStatus("app:billing-sync", "disabled")).toBe(true)
  expect(registry.active("app:billing-sync")).toBe(false)
  expect(registry.get("app:billing-sync")?.kind).toBe("app")
})

test("keys that were never registered are not active", () => {
  const registry = makePrincipalRegistry()
  expect(registry.active("user:nobody")).toBe(false)
  expect(registry.get("user:nobody")).toBeUndefined()
  expect(registry.setStatus("user:nobody", "disabled")).toBe(false)
})
