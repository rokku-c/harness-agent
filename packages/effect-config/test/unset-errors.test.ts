import { expect, test } from "bun:test"
import { nested } from "./nested-fixture.ts"
import { open, workspace } from "./fixture.ts"

test("patch/unset conflicts are rejected without changing values, sources, or revision", () => {
  const { registry, store } = open(workspace().file)
  const initial = registry.initialize("demo", { yaml: { label: "yaml" } })
  const raw = store.read("demo")
  const failed = registry.save("demo", { label: "changed" }, { unset: ["label"] })
  expect(failed.ok).toBe(false)
  expect(failed.error).toBe("config key cannot be both patched and unset")
  expect(store.read("demo")).toEqual(raw)
  expect(registry.read("demo")).toEqual(initial)
})

test("removing a required field rejects the entire save, including otherwise valid patch fields", () => {
  const { registry, store } = open(workspace().file, nested)
  const initial = registry.initialize("demo")
  const raw = store.read("demo")
  const failed = registry.save("demo", { note: "must-not-save" }, { unset: ["route"] })
  expect(failed.ok).toBe(false)
  expect(failed.error).toContain("route")
  expect(store.read("demo")).toEqual(raw)
  expect(registry.read("demo")).toEqual(initial)
})

test("invalid patches cannot partially commit a requested default reset", () => {
  const { registry, store } = open(workspace().file)
  const initial = registry.initialize("demo", { yaml: { label: "keep" } })
  const raw = store.read("demo")
  expect(registry.save("demo", { limit: 0 }, { unset: ["label"] }).ok).toBe(false)
  expect(store.read("demo")).toEqual(raw)
  expect(registry.read("demo")).toEqual(initial)
})

