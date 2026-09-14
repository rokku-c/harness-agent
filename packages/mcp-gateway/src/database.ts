import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export const principalColumns = "key, kind, id, display_name, status, created_at"
export const tokenColumns = "token_hash, principal_key, issued_at, expires_at, revoked_at, last_used_at"

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS principals (key TEXT PRIMARY KEY, kind TEXT, id TEXT, display_name TEXT, status TEXT, created_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, principal_key TEXT, issued_at INTEGER, expires_at INTEGER, revoked_at INTEGER, last_used_at INTEGER)`,
]

const PROBE = [
  `SELECT ${principalColumns} FROM principals LIMIT 0`,
  `SELECT ${tokenColumns} FROM tokens LIMIT 0`,
]

export const openGatewayDatabase = (file: string): Database => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const database = new Database(file, { create: true })
  try {
    for (const statement of SCHEMA) database.run(statement)
    for (const statement of PROBE) database.query(statement).all()
  } catch (error) {
    database.close()
    throw error
  }
  return database
}
