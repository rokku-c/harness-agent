/**
 * An identity, as the console reads it.
 *
 * Two records, because they answer two questions: who exists, and what each of
 * them can present. They are read at one moment — the same `at` decides both
 * whether a token has expired and nothing else — so a listing is one answer
 * rather than two that disagree about now.
 *
 * A token is named by the first bytes of its hash. The plaintext is gone by the
 * time anything reads this, so the hash is the only name the record has, and its
 * first eight characters are the part a person can hold in mind and match
 * against a token they were handed. The whole hash stays beside it, because that
 * is what a revocation addresses.
 *
 * Timestamps are ISO 8601 in UTC: one form that sorts, that a machine reads
 * without a locale, and that a person reads without a table of epoch offsets.
 */
import { principalKey } from "@effect-agent/effect-authz"
import type { PrincipalRecord, TokenRecord } from "@effect-agent/mcp-gateway"

export interface PrincipalRow {
  readonly key: string
  readonly kind: string
  readonly id: string
  readonly status: string
  readonly created: string
  readonly displayName?: string
}

export interface TokenRow {
  readonly tokenHash: string
  readonly fingerprint: string
  readonly principalKey: string
  readonly status: string
  readonly issued: string
  readonly expires?: string
  readonly lastUsed?: string
}

/** No milliseconds: they are noise in every reading, and the store keeps them. */
const iso = (at: number): string => new Date(at).toISOString().replace(/\.\d{3}Z$/, "Z")

/** The one place a token's state is read off its record, so a listing cannot invent a fourth. */
const tokenStatus = (record: TokenRecord, at: number): string =>
  record.revokedAt !== undefined ? "revoked"
    : record.expiresAt !== undefined && record.expiresAt <= at ? "expired" : "active"

export const principalRow = (record: PrincipalRecord): PrincipalRow => ({
  key: principalKey(record),
  kind: record.kind,
  id: record.id,
  status: record.status,
  created: iso(record.createdAt),
  ...(record.displayName === undefined ? {} : { displayName: record.displayName }),
})

export const tokenRow = (record: TokenRecord, at: number): TokenRow => ({
  tokenHash: record.tokenHash,
  fingerprint: record.tokenHash.slice(0, 8),
  principalKey: record.principalKey,
  status: tokenStatus(record, at),
  issued: iso(record.issuedAt),
  ...(record.expiresAt === undefined ? {} : { expires: iso(record.expiresAt) }),
  ...(record.lastUsedAt === undefined ? {} : { lastUsed: iso(record.lastUsedAt) }),
})
