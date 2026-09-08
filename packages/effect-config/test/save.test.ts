import { expect, test } from "bun:test"
import { z } from "../src/index.ts"
import { open, workspace } from "./fixture.ts"

test("save is a top-level patch with whole-array replacement and retained unpatched sources", () => {
  const { registry } = open(workspace().file)
  registry.initialize("demo", { yaml: { label: "yaml", limit: 7,
    providers: [{ id: "first", url: "https://first.invalid" }, { id: "second", url: "https://second.invalid" }] } })
  const saved = registry.save("demo", { providers: [{ id: "new", url: "https://new.invalid" }] })
  expect(saved).toEqual({ ok: true, appId: "demo", revision: 2,
    value: { label: "yaml", limit: 7, enabled: false, providers: [{ id: "new", url: "https://new.invalid" }] },
    sources: { label: "yaml", limit: "yaml", enabled: "default", providers: "override" } })
  expect(registry.save("demo", { providers: [] }).value).toEqual({
    label: "yaml", limit: 7, enabled: false, providers: [],
  })
})

test("invalid saves preserve all previously committed values, sources, and revision", () => {
  const { registry, store } = open(workspace().file)
  const initialized = registry.initialize("demo", { yaml: { limit: 7 } })
  const raw = store.read("demo")
  for (const patch of [{ limit: "bad" }, { providers: [{}] }, null, [], 4, "bad", undefined]) {
    expect(registry.save("demo", patch).ok).toBe(false)
    expect(store.read("demo")).toEqual(raw)
    expect(registry.read("demo")).toEqual(initialized)
  }
  expect(registry.save("demo", { limit: 8 }).revision).toBe(2)
})

test("patching an equal-valued field still explicitly changes its origin to override", () => {
  const { registry } = open(workspace().file)
  registry.initialize("demo", { yaml: { limit: 7 } })
  const saved = registry.save("demo", { limit: 7 })
  expect(saved.sources.limit).toBe("override")
  expect(saved.sources.label).toBe("default")
  expect(saved.revision).toBe(2)
})

test("nested objects are replaced, not recursively merged", () => {
  const { registry } = open(workspace().file, { appId: "demo",
    schema: z.object({ settings: z.object({ left: z.number(), right: z.number() }) }),
    default: { settings: { left: 1, right: 2 } } })
  const initial = registry.initialize("demo")
  expect(registry.save("demo", { settings: { left: 3 } }).ok).toBe(false)
  expect(registry.read("demo")).toEqual(initial)
  expect(registry.save("demo", { settings: { left: 3, right: 4 } }).value)
    .toEqual({ settings: { left: 3, right: 4 } })
})

test("serialization failure cannot overwrite a valid previous record", () => {
  const { registry, store } = open(workspace().file, { appId: "demo",
    schema: z.object({ value: z.any().default(1) }) })
  const initial = registry.initialize("demo")
  const raw = store.read("demo")
  expect(registry.save("demo", { value: 1n }).ok).toBe(false)
  expect(store.read("demo")).toEqual(raw)
  expect(registry.read("demo")).toEqual(initial)
})

test("JSON serialization cannot silently discard or normalize configuration values", () => {
  const { registry, store } = open(workspace().file, { appId: "demo",
    schema: z.object({ value: z.any().default(1) }) })
  const initial = registry.initialize("demo")
  const raw = store.read("demo")
  for (const value of [{ nested: undefined }, Number.NaN, Infinity, new Date(0)]) {
    expect(registry.save("demo", { value }).ok).toBe(false)
    expect(store.read("demo")).toEqual(raw)
    expect(registry.read("demo")).toEqual(initial)
  }
})
