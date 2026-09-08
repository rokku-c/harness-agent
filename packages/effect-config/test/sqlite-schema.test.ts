import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { makeSqliteConfigStore } from "../src/index.ts"
import { workspace } from "./fixture.ts"

const schemas = [
  "appId TEXT PRIMARY KEY, value TEXT NOT NULL",
  "appId TEXT PRIMARY KEY, value TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '{}'",
  "appId TEXT PRIMARY KEY, value TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '{}', revision TEXT NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0",
  "appId TEXT, value TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0",
  "appId TEXT PRIMARY KEY, value TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0, extra TEXT",
]

for (const [index, columns] of schemas.entries()) test(`incompatible table ${index} fails without modifying schema or bytes`, () => {
  const { file } = workspace()
  mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  db.run(`CREATE TABLE app_config (${columns})`)
  db.run("INSERT INTO app_config (appId, value) VALUES (?, ?)", ["demo", '{"oldSetting":"keep"}'])
  const schema = db.query("SELECT sql FROM sqlite_master WHERE name = 'app_config'").get()
  const rows = db.query("SELECT * FROM app_config").all()
  db.close()
  const bytes = readFileSync(file)
  expect(() => makeSqliteConfigStore({ file })).toThrow("operator must rebuild")
  expect(readFileSync(file)).toEqual(bytes)
  const check = new Database(file, { readonly: true })
  try {
    expect(check.query("SELECT sql FROM sqlite_master WHERE name = 'app_config'").get()).toEqual(schema)
    expect(check.query("SELECT * FROM app_config").all()).toEqual(rows)
  } finally { check.close() }
})

test("a non-SQLite config file is rejected without importing or replacing its contents", () => {
  const { file } = workspace()
  mkdirSync(dirname(file), { recursive: true })
  const contents = '{"demo":{"oldSetting":"preserve"}}'
  writeFileSync(file, contents)
  expect(() => makeSqliteConfigStore({ file })).toThrow("operator must rebuild")
  expect(readFileSync(file, "utf8")).toBe(contents)
})
