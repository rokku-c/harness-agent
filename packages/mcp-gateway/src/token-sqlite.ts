import type { Database } from "bun:sqlite"
import { randomBytes } from "node:crypto"

import { tokenColumns } from "./database.ts"
import { hashToken, type IssuedToken, type IssueTokenInput, type TokenRecord, type TokenStore } from "./token.ts"

const PREFIX = "t_"
const SELECT = `SELECT ${tokenColumns} FROM tokens`

interface Row {
  readonly token_hash: string
  readonly principal_key: string
  readonly issued_at: number
  readonly expires_at: number | null
  readonly revoked_at: number | null
  readonly last_used_at: number | null
}

const asRecord = (row: Row): TokenRecord => ({
  tokenHash: row.token_hash, principalKey: row.principal_key, issuedAt: row.issued_at,
  ...(row.expires_at === null ? {} : { expiresAt: row.expires_at }),
  ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
  ...(row.last_used_at === null ? {} : { lastUsedAt: row.last_used_at }),
})

export const makeStoredTokens = (database: Database, now: () => number = () => Date.now()): TokenStore => {
  const read = (hash: string): Row | null => database.query(`${SELECT} WHERE token_hash = ?`).get(hash) as Row | null

  const issue = ({ principalKey, ttlMs }: IssueTokenInput): IssuedToken => {
    const issuedAt = now()
    const token = PREFIX + randomBytes(32).toString("base64url")
    const record: TokenRecord = {
      tokenHash: hashToken(token), principalKey, issuedAt,
      ...(ttlMs === undefined ? {} : { expiresAt: issuedAt + ttlMs }),
    }
    database.run("INSERT INTO tokens (token_hash, principal_key, issued_at, expires_at) VALUES (?, ?, ?, ?)",
      [record.tokenHash, record.principalKey, record.issuedAt, record.expiresAt ?? null])
    return { token, record }
  }

  const verify = (token: string): TokenRecord | undefined => {
    const row = read(hashToken(token))
    if (row === null || row.revoked_at !== null) return undefined
    const at = now()
    if (row.expires_at !== null && row.expires_at <= at) return undefined
    database.run("UPDATE tokens SET last_used_at = ? WHERE token_hash = ?", [at, row.token_hash])
    return asRecord({ ...row, last_used_at: at })
  }

  const revoke = (tokenHash: string): boolean => {
    const row = read(tokenHash)
    if (row === null || row.revoked_at !== null) return false
    database.run("UPDATE tokens SET revoked_at = ? WHERE token_hash = ?", [now(), tokenHash])
    return true
  }

  return {
    issue, verify, revoke,
    list: () => (database.query(`${SELECT} ORDER BY issued_at DESC, token_hash`).all() as Row[]).map(asRecord),
  }
}
