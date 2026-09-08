import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { Launcher } from "./options.ts"

export const parseLaunchers = (value: unknown): Launcher[] => {
  if (!Array.isArray(value) || !value.every(l => l && typeof l === "object" &&
    typeof l.kind === "string" && typeof l.label === "string")) {
    throw new Error("Invalid launcher data; expected an array of {kind, label, config?}")
  }
  return value
}
export const makeLauncherStore = (file: string, seeds: readonly Launcher[]) => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const database = new Database(file, { create: true })
  try {
    database.run("CREATE TABLE IF NOT EXISTS deck_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    const columns = database.query("PRAGMA table_info(deck_config)").all() as { name: string; type: string; pk: number; notnull: number }[]
    if (columns.length !== 2 || columns[0].name !== "key" || columns[0].type !== "TEXT" || columns[0].pk !== 1 ||
      columns[1].name !== "value" || columns[1].type !== "TEXT" || columns[1].notnull !== 1) {
      throw new Error("Unsupported deck_config schema; rebuild explicitly, no automatic migration")
    }
    const launchers: Launcher[] = []
    const seed = (kind: string, label: string, config?: unknown) => {
      if (!launchers.some(l => l.kind === kind && l.label === label)) {
        launchers.push(config === undefined ? { kind, label } : { kind, label, config })
      }
    }
    const saved = database.query("SELECT value FROM deck_config WHERE key = 'launchers'").get() as { value: string } | null
    for (const l of [...parseLaunchers(seeds), ...parseLaunchers(saved === null ? [] : JSON.parse(saved.value))]) {
      seed(l.kind, l.label, l.config)
    }
    let closed = false
    return {
      launchers, seed,
      persist: () => database.run("INSERT OR REPLACE INTO deck_config VALUES ('launchers', ?)", [JSON.stringify(launchers)]),
      close: () => { if (!closed) { closed = true; database.close() } },
    }
  } catch (error) { database.close(); throw error }
}
