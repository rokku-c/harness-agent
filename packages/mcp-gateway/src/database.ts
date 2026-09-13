/**
 * mcp-gateway — the gateway's own file.
 *
 * Identities and their credentials are state, not configuration: a token is
 * generated once and never written down again, and a principal's status is a
 * fact about the world rather than a value in a form. They share one file
 * because they are one subject — who may call — and because a token's principal
 * key is a foreign key into the directory beside it.
 *
 * The schema is stated once here and read by the two stores, so a column cannot
 * be added to a table without the SELECT beside it moving too. The tables are
 * created with `IF NOT EXISTS` and then probed, so a file written by an older
 * shape fails at open, where the operator can be told to rebuild it, rather
 * than at the first call that reads a column which is not there.
 *
 * Storage lives in the package rather than in the app that mounts it because an
 * app may not touch a system builtin: it states which file it keeps its
 * identities in, and nothing about how a file is opened.
 */
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
