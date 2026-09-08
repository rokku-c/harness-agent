import { Database } from "bun:sqlite"
import { expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fixture } from "./helpers.ts"

test("launcher persistence survives a closed instance, explicit seeds take precedence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deck-store-")), configFile = join(dir, "deck.sqlite")
  const launcher = { kind: "demo", label: "saved", config: { cwd: "/tmp" } }
  try {
    const first = fixture({ configFile })
    try { await first.post("/api/launchers", launcher) } finally { await first.close() }
    const second = fixture({ configFile })
    try { expect((await second.get("/api/launchers")).launchers).toEqual([launcher]) } finally { await second.close() }
    const override = { ...launcher, config: { cwd: "/override" } }
    const third = fixture({ configFile, launchers: [override] })
    try { expect((await third.get("/api/launchers")).launchers).toEqual([override]) } finally { await third.close() }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("unsupported schema is not migrated and failed startup releases SQLite", () => {
  const dir = mkdtempSync(join(tmpdir(), "deck-schema-")), configFile = join(dir, "deck.sqlite")
  const db = new Database(configFile)
  db.run("CREATE TABLE deck_config (legacy TEXT)")
  db.run("INSERT INTO deck_config VALUES ('untouched')")
  db.close()
  const close = spyOn(Database.prototype, "close")
  try {
    expect(() => fixture({ configFile })).toThrow("Unsupported deck_config schema")
    expect(close).toHaveBeenCalledTimes(1)
    const check = new Database(configFile, { readonly: true })
    try { expect(check.query("SELECT legacy FROM deck_config").all()).toEqual([{ legacy: "untouched" }]) }
    finally { check.close() }
  } finally { close.mockRestore(); rmSync(dir, { recursive: true, force: true }) }
})

test("malformed stored launchers fail explicitly without rewriting the record", () => {
  const dir = mkdtempSync(join(tmpdir(), "deck-invalid-")), configFile = join(dir, "deck.sqlite")
  const db = new Database(configFile)
  db.run("CREATE TABLE deck_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
  db.run("INSERT INTO deck_config VALUES ('launchers', '{}')")
  db.close()
  try {
    expect(() => fixture({ configFile })).toThrow("Invalid launcher data")
    const check = new Database(configFile, { readonly: true })
    try { expect(check.query("SELECT value FROM deck_config").get()).toEqual({ value: "{}" }) }
    finally { check.close() }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
