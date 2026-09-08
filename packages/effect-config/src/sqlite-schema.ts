import type { Database } from "bun:sqlite"
import { rebuildRequired } from "./errors.ts"

type Column = { name: string; type: string; notnull: number; pk: number; dflt_value: string | null; hidden: number }
const columns: ReadonlyArray<readonly [string, string, number, number, string | null]> = [
  ["appId", "TEXT", 0, 1, null], ["value", "TEXT", 1, 0, null],
  ["sources", "TEXT", 1, 0, "'{}'"], ["revision", "INTEGER", 1, 0, "0"],
  ["initialized", "INTEGER", 1, 0, "0"],
]

/** Create only a missing table. Existing incompatible tables are never altered. */
export function initializeSchema(db: Database): void {
  db.transaction(() => {
    const existing = db.query<{ type: string }, []>("SELECT type FROM sqlite_master WHERE name = 'app_config'").get()
    if (existing === null) {
      db.run(`CREATE TABLE app_config (
        appId TEXT PRIMARY KEY, value TEXT NOT NULL,
        sources TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
        initialized INTEGER NOT NULL DEFAULT 0
      )`)
      return
    }
    const actual = db.query<Column, []>("PRAGMA table_xinfo(app_config)").all()
    if (existing.type !== "table" || actual.length !== columns.length || columns.some(([name, type, notnull, pk, dflt]) => {
      const column = actual.find((column) => column.name === name)
      return !column || column.type !== type || column.notnull !== notnull || column.pk !== pk ||
        column.dflt_value !== dflt || column.hidden !== 0
    })) throw rebuildRequired("config database schema")
  }).immediate()
}
