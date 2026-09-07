import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export interface BoardSnapshot {
  readonly items?: unknown[]
  readonly resources?: unknown[]
  readonly executors?: unknown[]
  readonly agents?: unknown[]
  readonly executions?: unknown[]
  readonly consents?: unknown[]
}

const open = (file: string): Database => {
  mkdirSync(dirname(file), { recursive: true })
  const database = new Database(file, { create: true })
  database.run("CREATE TABLE IF NOT EXISTS board_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
  return database
}

export const loadBoardSnapshot = (file: string | undefined): BoardSnapshot => {
  if (file === undefined) return {}
  const database = open(file)
  const row = database.query("SELECT value FROM board_state WHERE key = 'snapshot'").get() as { value: string } | null
  database.close()
  return row === null ? {} : JSON.parse(row.value) as BoardSnapshot
}

export const saveBoardSnapshot = (file: string, snapshot: BoardSnapshot): void => {
  const database = open(file)
  database.run("INSERT OR REPLACE INTO board_state VALUES ('snapshot', ?)", [JSON.stringify(snapshot)])
  database.close()
}
