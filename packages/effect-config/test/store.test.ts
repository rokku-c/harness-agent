import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { makeConfigRegistry, makeSqliteConfigStore } from "../src/index.ts"
import { declaration, open, workspace } from "./fixture.ts"

test("store close is idempotent and closed persistent operations fail cleanly", () => {
  const { registry, store } = open(workspace().file)
  registry.initialize("demo")
  store.close()
  store.close()
  expect(() => store.read("demo")).toThrow("closed")
  expect(registry.read("demo").ok).toBe(false)
  expect(registry.save("demo", { limit: 5 }).ok).toBe(false)
})

test("injected store lifetime belongs to the caller, not an individual registry", () => {
  const { registry, store } = open(workspace().file)
  const initialized = registry.initialize("demo")
  registry.close()
  expect(registry.read("demo").ok).toBe(false)
  const second = makeConfigRegistry({ store })
  second.register(declaration)
  expect(second.read("demo")).toEqual(initialized)
})

test("SQLite transactions roll back writes on failure", () => {
  const { registry, store } = open(workspace().file)
  registry.initialize("demo")
  const initial = store.read("demo")!
  expect(() => store.transaction(() => {
    store.write("demo", { ...initial, value: { limit: 50 }, revision: 2 })
    throw new Error("rollback")
  })).toThrow("rollback")
  expect(store.read("demo")).toEqual(initial)
})

test("neighboring JSON files are neither imported nor modified", () => {
  const { file } = workspace()
  const disk = makeSqliteConfigStore({ file })
  const memory = makeSqliteConfigStore({ file: ":memory:" })
  try {
    writeFileSync(join(dirname(file), "overrides.json"), JSON.stringify({ demo: { limit: 9 } }))
    const registry = makeConfigRegistry({ store: disk })
    registry.register(declaration)
    expect((registry.initialize("demo").value as { limit: number }).limit).toBe(3)
    expect(readFileSync(join(dirname(file), "overrides.json"), "utf8"))
      .toBe(JSON.stringify({ demo: { limit: 9 } }))
    expect(memory.read("demo")).toBeUndefined()
  } finally { disk.close(); memory.close() }
})

test("corrupt SQLite values fail instead of silently replacing authority with YAML", () => {
  const { file } = workspace()
  const { registry } = open(file)
  registry.initialize("demo")
  const db = new Database(file)
  try {
    db.run("UPDATE app_config SET value = ? WHERE appId = ?", ["corrupt", "demo"])
    expect(registry.initialize("demo", { yaml: { limit: 9 } }).ok).toBe(false)
    expect(registry.read("demo").ok).toBe(false)
    expect(registry.save("demo", { limit: 9 }).ok).toBe(false)
    expect(db.query("SELECT value, revision FROM app_config WHERE appId = ?").get("demo"))
      .toEqual({ value: "corrupt", revision: 1 })
  } finally { db.close() }
})
