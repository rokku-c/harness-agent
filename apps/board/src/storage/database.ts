import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { BoardError } from "../tasks/schema.ts"

/** Fresh task schema only. Never load/overwrite an old full-board snapshot. */
export const openBoardDatabase = (file: string): Database => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  try {
    db.run("PRAGMA busy_timeout=5000")
    const tables = db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    if (tables.length) {
      if (!tables.some((t) => t.name === "board_meta")) throw new BoardError(409, "Incompatible Board database; explicitly rebuild it (no migration)")
      const version = db.query<{ version: number }, []>("SELECT version FROM board_meta").get()
      if (version?.version !== 1 || tables.length !== 3 || !tables.some((t) => t.name === "tasks") || !tables.some((t) => t.name === "task_events")) {
        throw new BoardError(409, "Incompatible Board schema; explicitly rebuild it")
      }
    } else db.transaction(() => {
      db.run("CREATE TABLE board_meta(version INTEGER NOT NULL)")
      db.run("INSERT INTO board_meta VALUES(1)")
      db.run("CREATE TABLE tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL)")
      db.run("CREATE TABLE task_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, taskId TEXT NOT NULL, data TEXT NOT NULL)")
    }).immediate()
    return db
  } catch (error) { db.close(); throw error }
}
