import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { BoardError } from "../tasks/schema.ts"
import { clearStore } from "./clean.ts"

export type StorePolicy = "clean" | "refuse"

const VERSION = 3
const TABLES = ["agents", "board_meta", "documents", "runs", "task_events", "tasks"]

const prepared = (file: string): Database => {
  const db = new Database(file)
  db.run("PRAGMA busy_timeout=5000")
  return db
}

const listTables = (db: Database): readonly string[] =>
  db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    .map((row) => row.name)

const createSchema = (db: Database): void => {
  db.transaction(() => {
    db.run("CREATE TABLE board_meta(version INTEGER NOT NULL)")
    db.run(`INSERT INTO board_meta VALUES(${VERSION})`)
    db.run("CREATE TABLE tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL)")
    db.run("CREATE TABLE task_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, taskId TEXT NOT NULL, data TEXT NOT NULL)")
    db.run("CREATE TABLE agents(id TEXT PRIMARY KEY, data TEXT NOT NULL)")
    db.run("CREATE TABLE runs(id TEXT PRIMARY KEY, nodeId TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL)")
    db.run("CREATE INDEX runs_by_node ON runs(nodeId, status)")
    db.run("CREATE TABLE documents(id TEXT PRIMARY KEY, data TEXT NOT NULL)")
  }).immediate()
}

const created = (db: Database): Database => {
  try { createSchema(db); return db } catch (error) { db.close(); throw error }
}

const reasonFor = (db: Database, tables: readonly string[]): string | undefined => {
  if (tables.length === 0) return undefined
  if (!tables.includes("board_meta")) return "it has no board_meta table"
  const version = db.query<{ version: number }, []>("SELECT version FROM board_meta").get()?.version
  if (version !== VERSION) return `it declares board schema version ${version ?? "nothing"}, not ${VERSION}`
  const missing = TABLES.filter((name) => !tables.includes(name))
  const extra = tables.filter((name) => !TABLES.includes(name))
  if (missing.length === 0 && extra.length === 0) return undefined
  return `its tables are ${tables.join(", ")}`
}

export const openBoardDatabase = (file: string, policy: StorePolicy = "clean"): Database => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const found = prepared(file)
  const tables = listTables(found)
  const reason = reasonFor(found, tables)
  if (reason === undefined) return tables.length === 0 ? created(found) : found
  found.close()
  if (policy === "refuse") {
    throw new BoardError(409, `Incompatible Board store at ${file}: ${reason}. Rebuild it, or set incompatibleStore to "clean" to have it moved aside.`)
  }
  console.error(`[board] ${file}: ${reason}; moved to ${clearStore(file)} and started a fresh store`)
  return created(prepared(file))
}
