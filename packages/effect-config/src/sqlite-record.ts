import { isDeepStrictEqual } from "node:util"
import type { Database } from "bun:sqlite"
import type { ConfigSource } from "./contract.ts"
import { ConfigError, rebuildRequired } from "./errors.ts"
import type { StoredConfig } from "./store.ts"
import { isRecord } from "./validation.ts"

type Row = { value: string; sources: string; revision: number; initialized: number }

function decode(text: string, field: string): unknown {
  try { return JSON.parse(text) }
  catch { throw rebuildRequired(`stored config ${field}`) }
}

export function readRecord(db: Database, appId: string): StoredConfig | undefined {
  const row = db.query<Row, [string]>(
    "SELECT value, sources, revision, initialized FROM app_config WHERE appId = ?",
  ).get(appId)
  if (!row) return undefined
  const value = decode(row.value, "value")
  const sources = decode(row.sources, "sources")
  if (!isRecord(value) || !isRecord(sources) || Object.keys(value).length !== Object.keys(sources).length ||
    Object.keys(value).some((key) => !Object.hasOwn(sources, key)) || Object.values(sources).some((source) =>
      source !== "default" && source !== "yaml" && source !== "override"))
    throw rebuildRequired("stored config value/sources")
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || row.initialized !== 1)
    throw rebuildRequired("stored config metadata")
  return { value, sources: sources as Record<string, ConfigSource>, revision: row.revision, initialized: true }
}

export function writeRecord(db: Database, appId: string, record: StoredConfig): void {
  const value = JSON.stringify(record.value)
  if (value === undefined || !isDeepStrictEqual(JSON.parse(value), record.value))
    throw new ConfigError("config must be JSON serializable without data loss")
  db.run(`INSERT INTO app_config (appId, value, sources, revision, initialized)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(appId) DO UPDATE SET
    value = excluded.value, sources = excluded.sources,
    revision = excluded.revision, initialized = excluded.initialized`,
  [appId, value, JSON.stringify(record.sources), record.revision, Number(record.initialized)])
}
