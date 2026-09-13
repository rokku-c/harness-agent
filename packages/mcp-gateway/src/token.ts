/**
 * mcp-gateway — opaque bearer tokens.
 *
 * A token is stored only as its SHA-256 hash, so a leaked store cannot be
 * replayed as credentials. Verification is a hash lookup plus an expiry and
 * revocation check, and every failure returns undefined — the caller denies.
 *
 * The store is a port: `makeTokenStore` is the in-memory implementation, and
 * the app is free to back the same interface with sqlite.
 */

import { createHash, randomBytes } from "node:crypto"

export interface TokenRecord {
  readonly tokenHash: string
  readonly principalKey: string
  readonly issuedAt: number
  readonly expiresAt?: number
  readonly revokedAt?: number
  readonly lastUsedAt?: number
}

export interface IssueTokenInput {
  readonly principalKey: string
  /** Lifetime in milliseconds from `issuedAt`; omitted means no expiry. */
  readonly ttlMs?: number
}

export interface IssuedToken {
  readonly token: string
  readonly record: TokenRecord
}

export interface TokenStore {
  issue(input: IssueTokenInput): IssuedToken
  /** undefined when unknown, expired or revoked. */
  verify(token: string): TokenRecord | undefined
  /** false when unknown or already revoked. */
  revoke(token: string): boolean
  list(): readonly TokenRecord[]
}

const TOKEN_PREFIX = "t_"

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex")

export const makeTokenStore = (options: { readonly now?: () => number } = {}): TokenStore => {
  const now = options.now ?? (() => Date.now())
  const records = new Map<string, TokenRecord>()

  const issue = ({ principalKey, ttlMs }: IssueTokenInput): IssuedToken => {
    const issuedAt = now()
    const token = TOKEN_PREFIX + randomBytes(32).toString("base64url")
    const record: TokenRecord = {
      tokenHash: hashToken(token),
      principalKey,
      issuedAt,
      ...(ttlMs === undefined ? {} : { expiresAt: issuedAt + ttlMs }),
    }
    records.set(record.tokenHash, record)
    return { token, record }
  }

  const verify = (token: string): TokenRecord | undefined => {
    const record = records.get(hashToken(token))
    if (record === undefined || record.revokedAt !== undefined) return undefined
    const at = now()
    if (record.expiresAt !== undefined && record.expiresAt <= at) return undefined
    const touched: TokenRecord = { ...record, lastUsedAt: at }
    records.set(touched.tokenHash, touched)
    return touched
  }

  const revoke = (token: string): boolean => {
    const hash = hashToken(token)
    const record = records.get(hash)
    if (record === undefined || record.revokedAt !== undefined) return false
    records.set(hash, { ...record, revokedAt: now() })
    return true
  }

  return { issue, verify, revoke, list: () => [...records.values()] }
}
