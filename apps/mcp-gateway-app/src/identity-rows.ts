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

const iso = (at: number): string => new Date(at).toISOString().replace(/\.\d{3}Z$/, "Z")

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
