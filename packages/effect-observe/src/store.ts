/**
 * ObservationStore persisted to SQLite (bun:sqlite): frames live as rows in
 * observation_frames and replay in recorded order. The store never samples —
 * callers feed it snapshots via record().
 */
import { Database, type SQLQueryBindings } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { ObservationSnapshot, Perspective } from "./types.ts"

export interface FrameQuery {
  perspective?: Perspective
  target?: string
  since?: number
  until?: number
}

export interface ObservationStore {
  record(snapshot: ObservationSnapshot): void
  frames(query?: FrameQuery): ObservationSnapshot[]
  latest(perspective: Perspective, target: string): ObservationSnapshot | undefined
  count(): number
  close(): void
}

interface FrameRow {
  at: number
  perspective: string
  target: string
  data: string
}

const COLUMNS = "at, perspective, target, data"

const toSnapshot = (row: FrameRow): ObservationSnapshot => ({
  at: row.at,
  perspective: row.perspective as Perspective,
  target: row.target,
  data: JSON.parse(row.data) as unknown,
})

/** Open the database (creating the file's dir when needed) and ensure schema. */
const open = (file: string): Database => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const database = new Database(file, { create: true })
  database.exec(
    "CREATE TABLE IF NOT EXISTS observation_frames " +
      "(at INTEGER, perspective TEXT, target TEXT, data TEXT);" +
      "CREATE INDEX IF NOT EXISTS observation_frames_pta " +
      "ON observation_frames (perspective, target, at);",
  )
  return database
}

const select = (query: FrameQuery): { sql: string; params: SQLQueryBindings[] } => {
  const conditions: string[] = []
  const params: SQLQueryBindings[] = []
  if (query.perspective !== undefined) { conditions.push("perspective = ?"); params.push(query.perspective) }
  if (query.target !== undefined) { conditions.push("target = ?"); params.push(query.target) }
  if (query.since !== undefined) { conditions.push("at >= ?"); params.push(query.since) }
  if (query.until !== undefined) { conditions.push("at <= ?"); params.push(query.until) }
  const where = conditions.length === 0 ? "" : ` WHERE ${conditions.join(" AND ")}`
  return { sql: `SELECT ${COLUMNS} FROM observation_frames${where} ORDER BY at ASC, rowid ASC`, params }
}

export const createObservationStore = (file?: string): ObservationStore => {
  const database = open(file ?? ".effect-agent/observe.sqlite")
  const insert = database.prepare<unknown, [number, Perspective, string, string]>(
    "INSERT INTO observation_frames (at, perspective, target, data) VALUES (?, ?, ?, ?)",
  )
  let closed = false
  return {
    close() { if (!closed) { database.close(); closed = true } },
    record(snapshot: ObservationSnapshot): void {
      insert.run(snapshot.at, snapshot.perspective, snapshot.target, JSON.stringify(snapshot.data))
    },
    frames(query: FrameQuery = {}): ObservationSnapshot[] {
      const built = select(query)
      return database.query<FrameRow, SQLQueryBindings[]>(built.sql).all(...built.params).map(toSnapshot)
    },
    latest(perspective: Perspective, target: string): ObservationSnapshot | undefined {
      const row = database
        .query<FrameRow, [Perspective, string]>(
          `SELECT ${COLUMNS} FROM observation_frames WHERE perspective = ? AND target = ? ` +
            "ORDER BY at DESC, rowid DESC LIMIT 1",
        )
        .get(perspective, target)
      return row === null ? undefined : toSnapshot(row)
    },
    count(): number {
      const row = database.query<{ n: number }, SQLQueryBindings[]>("SELECT COUNT(*) AS n FROM observation_frames").get()
      return row?.n ?? 0
    },
  }
}
