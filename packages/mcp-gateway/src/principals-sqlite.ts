import type { Database } from "bun:sqlite"
import { principalKey, type PrincipalKind } from "@effect-agent/effect-authz"

import { principalColumns } from "./database.ts"
import type { PrincipalRecord, PrincipalRegistry, PrincipalStatus, RegisterPrincipalInput } from "./principals.ts"

interface Row {
  readonly key: string
  readonly kind: PrincipalKind
  readonly id: string
  readonly display_name: string | null
  readonly status: PrincipalStatus
  readonly created_at: number
}

const SELECT = `SELECT ${principalColumns} FROM principals`

const asRecord = (row: Row): PrincipalRecord => ({
  kind: row.kind, id: row.id, status: row.status, createdAt: row.created_at,
  ...(row.display_name === null ? {} : { displayName: row.display_name }),
})

export const makeStoredPrincipals = (database: Database, now: () => number = () => Date.now()): PrincipalRegistry => {
  const read = (key: string): Row | null => database.query(`${SELECT} WHERE key = ?`).get(key) as Row | null

  const register = ({ kind, id, displayName }: RegisterPrincipalInput): PrincipalRecord => {
    const key = principalKey({ kind, id })
    const existing = read(key)
    database.run(
      "INSERT INTO principals (key, kind, id, display_name, status, created_at) VALUES (?, ?, ?, ?, 'active', ?) " +
      "ON CONFLICT(key) DO UPDATE SET display_name = excluded.display_name, status = 'active'",
      [key, kind, id, displayName ?? null, existing?.created_at ?? now()])
    return asRecord(read(key) as Row)
  }

  const setStatus = (key: string, status: PrincipalStatus): boolean => {
    if (read(key) === null) return false
    database.run("UPDATE principals SET status = ? WHERE key = ?", [status, key])
    return true
  }

  return {
    register,
    get: (key) => { const row = read(key); return row === null ? undefined : asRecord(row) },
    list: () => (database.query(`${SELECT} ORDER BY created_at, key`).all() as Row[]).map(asRecord),
    setStatus,
    active: (key) => read(key)?.status === "active",
  }
}
