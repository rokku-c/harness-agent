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
  readonly ttlMs?: number
}

export interface IssuedToken {
  readonly token: string
  readonly record: TokenRecord
}

export interface TokenStore {
  issue(input: IssueTokenInput): IssuedToken
  verify(token: string): TokenRecord | undefined
  revoke(tokenHash: string): boolean
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

  const revoke = (tokenHash: string): boolean => {
    const record = records.get(tokenHash)
    if (record === undefined || record.revokedAt !== undefined) return false
    records.set(tokenHash, { ...record, revokedAt: now() })
    return true
  }

  return { issue, verify, revoke, list: () => [...records.values()] }
}
