import { expect, test } from "bun:test"
import { makeUIDataStore } from "../src/index.ts"

test("reads and safely writes nested data paths", () => {
  const data = makeUIDataStore({ user: { name: "Ada" } })
  data.set("$.user.id", 7)
  expect(data.get("$user.name")).toBe("Ada")
  expect(data.get("$.user.id")).toBe(7)
})

test("notifies subscribers and isolates snapshots", () => {
  const data = makeUIDataStore({ count: 0 })
  let changes = 0
  const stop = data.subscribe(() => { changes += 1 })
  data.set("count", 1)
  stop()
  const snapshot = data.snapshot() as { count: number }
  snapshot.count = 9
  expect(changes).toBe(1)
  expect(data.get("count")).toBe(1)
})
