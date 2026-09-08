import { expect, test } from "bun:test"
import { declaration, open, workspace } from "./fixture.ts"

test("initialize persists declaration/schema defaults and per-key layer sources", () => {
  const { registry, store } = open(workspace().file)
  const out = registry.initialize("demo", { yaml: { limit: 7 }, override: { enabled: true } })
  expect(out).toEqual({ ok: true, appId: "demo", revision: 1,
    value: { label: "declaration", limit: 7, enabled: true, providers: [] },
    sources: { label: "default", limit: "yaml", enabled: "override", providers: "default" } })
  expect(store.read("demo")).toEqual({ value: out.value, sources: out.sources, revision: 1, initialized: true })
})

test("reopen retains SQLite authority instead of reapplying YAML, overrides, or declaration defaults", () => {
  const { file } = workspace()
  const first = open(file)
  first.registry.initialize("demo", { yaml: { label: "yaml", limit: 7 } })
  const saved = first.registry.save("demo", { enabled: true })
  first.store.close()
  const second = open(file, { ...declaration, default: { label: "changed" } })
  expect(second.registry.initialize("demo", {
    yaml: { label: "changed", limit: "invalid" }, override: { enabled: false },
  })).toEqual(saved)
  expect(second.registry.read("demo")).toEqual(saved)
  expect(second.registry.initialize("demo")).toEqual(saved)
})

test("read and patch use the latest database record across independent connections", () => {
  const { file } = workspace()
  const first = open(file)
  first.registry.initialize("demo", { yaml: { label: "yaml" } })
  const second = open(file)
  expect(second.registry.read("demo").revision).toBe(1)
  const saved = second.registry.save("demo", { limit: 10 })
  expect(first.registry.read("demo")).toEqual(saved)
  const patched = first.registry.save("demo", { enabled: true })
  expect(patched.revision).toBe(3)
  expect(patched.value).toEqual({ label: "yaml", limit: 10, enabled: true, providers: [] })
  expect(second.registry.read("demo")).toEqual(patched)
})

test("apply stays a pure layer merge; persistence requires initialization and registration", () => {
  const { registry, store } = open(workspace().file)
  expect(registry.apply("demo", { yaml: { limit: 9 } }).revision).toBeUndefined()
  expect(store.read("demo")).toBeUndefined()
  expect(registry.read("demo").ok).toBe(false)
  expect(registry.save("demo", { limit: 2 }).ok).toBe(false)
  expect(store.read("demo")).toBeUndefined()
  expect(registry.initialize("unknown").ok).toBe(false)
  expect(registry.read("unknown").ok).toBe(false)
  expect(registry.save("unknown", {}).ok).toBe(false)
})

test("invalid initialization writes nothing and can be retried with corrected input", () => {
  const { registry, store } = open(workspace().file)
  expect(registry.initialize("demo", { yaml: { limit: 0 } }).ok).toBe(false)
  expect(store.read("demo")).toBeUndefined()
  expect(registry.initialize("demo", { yaml: { limit: 1 } }).revision).toBe(1)
})

test("first import resolves conflicting keys in declaration < YAML < override order", () => {
  const { registry } = open(workspace().file, { ...declaration, default: { limit: 2 } })
  const input = { yaml: { limit: 7 }, override: { limit: 9 } }
  const out = registry.initialize("demo", input)
  expect(out.value).toEqual({ label: "schema", limit: 9, enabled: false, providers: [] })
  expect(out.sources).toEqual({ label: "default", limit: "override", enabled: "default", providers: "default" })
  expect(input).toEqual({ yaml: { limit: 7 }, override: { limit: 9 } })
})
