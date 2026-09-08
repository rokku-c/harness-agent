import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { z, type ConfigDeclaration } from "../src/index.ts"
import { open, workspace } from "./fixture.ts"

const old: ConfigDeclaration = { appId: "demo", schema: z.object({
  provider: z.string().default("old-provider"), apiKey: z.string().default("private-key"),
}) }
const current: ConfigDeclaration = { appId: "demo", schema: z.object({}) }

test("same-table old config cannot be stripped to an empty object or repaired through patch/unset", () => {
  const { file } = workspace()
  const first = open(file, old)
  const initial = first.registry.initialize("demo")
  const raw = first.store.read("demo")
  first.store.close()
  const bytes = readFileSync(file)
  const next = open(file, current)
  for (const result of [next.registry.initialize("demo", { override: {} }), next.registry.read("demo"),
    next.registry.save("demo", {}), next.registry.save("demo", {}, { unset: ["provider", "apiKey"] })]) {
    expect(result.ok).toBe(false)
    expect(result.error).toBe("stored config does not match the current schema; operator must rebuild the config store")
    expect(result.value).toEqual({})
    expect(next.store.read("demo")).toEqual(raw)
  }
  next.store.close()
  expect(readFileSync(file)).toEqual(bytes)
  expect(open(file, old).registry.read("demo")).toEqual(initial)
})

test("stripping objects reject unknown top-level fields on first import, pure apply, and save", () => {
  const { registry, store } = open(workspace().file, current)
  for (const layers of [{ yaml: { provider: "old" } }, { override: { apiKey: "private-key" } }]) {
    expect(registry.initialize("demo", layers).ok).toBe(false)
    expect(registry.apply("demo", layers).ok).toBe(false)
    expect(store.read("demo")).toBeUndefined()
  }
  registry.initialize("demo")
  const raw = store.read("demo")
  expect(registry.save("demo", { provider: "old" }).ok).toBe(false)
  expect(store.read("demo")).toEqual(raw)
})

test("new schema defaults cannot silently extend an existing authoritative record", () => {
  const { registry, store } = open(workspace().file, current)
  registry.initialize("demo")
  const raw = store.read("demo")
  registry.register({ appId: "demo", schema: z.object({ enabled: z.boolean().default(true) }) })
  expect(registry.initialize("demo").ok).toBe(false)
  expect(registry.read("demo").ok).toBe(false)
  expect(registry.save("demo", { enabled: false }).ok).toBe(false)
  expect(store.read("demo")).toEqual(raw)
})

test("nested stripping and schema transforms cannot normalize an existing record", () => {
  const { registry, store } = open(workspace().file, { appId: "demo",
    schema: z.object({ nested: z.object({ kept: z.string(), removed: z.string() }) }),
    default: { nested: { kept: "keep", removed: "retain" } } })
  registry.initialize("demo")
  const raw = store.read("demo")
  for (const schema of [z.object({ nested: z.object({ kept: z.string() }) }),
    z.object({ nested: z.object({ kept: z.string().transform(() => "changed"), removed: z.string() }) })]) {
    registry.register({ appId: "demo", schema })
    expect(registry.initialize("demo").ok).toBe(false)
    expect(registry.read("demo").ok).toBe(false)
    expect(registry.save("demo", {}).ok).toBe(false)
    expect(store.read("demo")).toEqual(raw)
  }
})

test("invalid layer types and unknown declaration defaults are rejected before import", () => {
  const { registry, store } = open(workspace().file, current)
  for (const yaml of [null, [], "old config", 42]) {
    expect(registry.initialize("demo", { yaml }).ok).toBe(false)
    expect(store.read("demo")).toBeUndefined()
  }
  registry.register({ ...current, default: { provider: "old" } })
  expect(registry.initialize("demo").ok).toBe(false)
  expect(store.read("demo")).toBeUndefined()
})

test("mutating preprocessors cannot conceal changes to an authoritative stored value", () => {
  const { registry, store } = open(workspace().file, old)
  registry.initialize("demo")
  const raw = store.read("demo")
  registry.register({ appId: "demo", schema: z.preprocess((value) => {
    (value as { provider: string }).provider = "changed"
    return value
  }, old.schema) })
  expect(registry.initialize("demo").ok).toBe(false)
  expect(registry.read("demo").ok).toBe(false)
  expect(registry.save("demo", {}).ok).toBe(false)
  expect(store.read("demo")).toEqual(raw)
})
