import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { DefinitionSnapshot } from "@effect-agent/ui-definition"

export interface CanvasStore {
  /** Snapshot committed by the previous process, or undefined on a fresh store. */
  load(): DefinitionSnapshot | undefined
  save(snapshot: DefinitionSnapshot): void
  close(): void
}

/** One durable owner per definition store; the activity store keeps its own table. */
export const makeCanvasStore = (file = ".effect-agent/ui.sqlite"): CanvasStore => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const database = new Database(file, { create: true })
  try {
    database.run("CREATE TABLE IF NOT EXISTS ui_canvas (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    database.query("SELECT key, value FROM ui_canvas LIMIT 0").all()
  } catch (error) {
    database.close()
    throw error
  }
  let closed = false
  return {
    load: () => {
      const row = database.query("SELECT value FROM ui_canvas WHERE key = ?").get("canvases") as { value: string } | null
      if (row === null) return undefined
      try {
        return { canvases: JSON.parse(row.value) as DefinitionSnapshot["canvases"], components: [] }
      } catch (error) {
        throw new Error("Invalid stored canvas snapshot: " + (error instanceof Error ? error.message : String(error)))
      }
    },
    save: (snapshot) => {
      database.run("INSERT INTO ui_canvas (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ["canvases", JSON.stringify(snapshot.canvases)])
    },
    close: () => {
      if (!closed) {
        closed = true
        database.close()
      }
    },
  }
}
