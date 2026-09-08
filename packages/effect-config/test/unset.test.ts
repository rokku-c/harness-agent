import { expect, test } from "bun:test"
import { z, type ConfigDeclaration, type ConfigSaveOptions } from "../src/index.ts"
import { nested } from "./nested-fixture.ts"
import { open, workspace } from "./fixture.ts"

const optional: ConfigDeclaration = { appId: "demo", schema: z.object({
  note: z.string().optional(), flag: z.boolean().optional(), label: z.string().default("schema"),
  limit: z.number().default(3),
}) }

test("unset removes optional text and boolean fields, retaining other values and sources across reopen", () => {
  const { file } = workspace()
  const first = open(file, optional)
  first.registry.initialize("demo", { yaml: { note: "remove", flag: true, label: "yaml" } })
  const options: ConfigSaveOptions = { unset: Object.freeze(["note", "flag"]) }
  const saved = first.registry.save("demo", { limit: 8 }, options)
  expect(saved).toEqual({ ok: true, appId: "demo", revision: 2,
    value: { label: "yaml", limit: 8 }, sources: { label: "yaml", limit: "override" } })
  expect(first.store.read("demo")).toEqual({ value: saved.value, sources: saved.sources,
    revision: 2, initialized: true })
  first.store.close()
  const second = open(file, optional)
  expect(second.registry.initialize("demo", { yaml: { note: "do-not-reapply", flag: true } })).toEqual(saved)
  expect(second.registry.read("demo")).toEqual(saved)
})

test("unset recreates schema defaults with default provenance, not declaration defaults or YAML", () => {
  const { registry } = open(workspace().file)
  registry.initialize("demo", { yaml: { label: "yaml", limit: 9, enabled: true,
    providers: [{ id: "old", url: "https://old.invalid" }] } })
  const saved = registry.save("demo", {}, { unset: ["label", "limit", "enabled", "providers"] })
  expect(saved).toEqual({ ok: true, appId: "demo", revision: 2,
    value: { label: "schema", limit: 3, enabled: false, providers: [] },
    sources: { label: "default", limit: "default", enabled: "default", providers: "default" } })
  expect(registry.initialize("demo")).toEqual(saved)
})

test("unset accepts unknown keys and treats dotted names as top-level keys, not paths", () => {
  const { registry } = open(workspace().file, nested)
  const initial = registry.initialize("demo")
  const saved = registry.save("demo", {}, { unset: ["missing", "route.path", "missing"] })
  expect(saved).toEqual({ ...initial, revision: 2 })
  expect(registry.read("demo")).toEqual(saved)
})

test("optional false is a saved value, distinct from an unset boolean", () => {
  const { registry } = open(workspace().file, optional)
  registry.initialize("demo", { yaml: { flag: true } })
  const saved = registry.save("demo", { flag: false })
  expect(saved.value).toEqual({ flag: false, label: "schema", limit: 3 })
  expect(saved.sources.flag).toBe("override")
  const cleared = registry.save("demo", {}, { unset: ["flag"] })
  expect(cleared.value).toEqual({ label: "schema", limit: 3 })
  expect(cleared.sources).toEqual({ label: "default", limit: "default" })
})
