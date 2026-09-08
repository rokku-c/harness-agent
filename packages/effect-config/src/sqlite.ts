import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { ConfigError, rebuildRequired } from "./errors.ts"
import { initializeSchema } from "./sqlite-schema.ts"
import { readRecord, writeRecord } from "./sqlite-record.ts"
import type { ConfigStore, SqliteConfigStoreOptions } from "./store.ts"

export function makeSqliteConfigStore(options: SqliteConfigStoreOptions = {}): ConfigStore {
  const file = options.file ?? ".effect-agent/config.sqlite"
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  try {
    db.run("PRAGMA busy_timeout = 5000")
    initializeSchema(db)
  } catch (error) {
    db.close()
    if (error instanceof ConfigError) throw error
    const code = (error as { code?: string })?.code
    if (code === "SQLITE_NOTADB" || code === "SQLITE_CORRUPT") throw rebuildRequired("config database")
    throw new ConfigError("cannot initialize config database")
  }
  let closed = false
  const assertOpen = () => { if (closed) throw new ConfigError("config store is closed") }
  return {
    read(appId) { assertOpen(); return readRecord(db, appId) },
    write(appId, record) { assertOpen(); writeRecord(db, appId, record) },
    transaction<T>(action: () => T): T {
      assertOpen()
      return db.transaction(action).immediate()
    },
    close() {
      if (closed) return
      db.close()
      closed = true
    },
  }
}
