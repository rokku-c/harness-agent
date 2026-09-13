/**
 * mcp-gateway — the principal directory.
 *
 * Records which identities exist and whether they are still active. Tokens
 * reference a principal by key, so cutting someone off is one flag here rather
 * than a hunt through every live token. The registry only ever answers "does
 * this identity exist and is it on"; what it may do is effect-authz's job.
 */

import { principalKey, type PrincipalKind } from "@effect-agent/effect-authz"

export type PrincipalStatus = "active" | "disabled"

export interface PrincipalRecord {
  readonly kind: PrincipalKind
  readonly id: string
  readonly displayName?: string
  readonly status: PrincipalStatus
  readonly createdAt: number
}

export interface RegisterPrincipalInput {
  readonly kind: PrincipalKind
  readonly id: string
  readonly displayName?: string
}

export interface PrincipalRegistry {
  register(input: RegisterPrincipalInput): PrincipalRecord
  get(key: string): PrincipalRecord | undefined
  list(): readonly PrincipalRecord[]
  /** false when the key was never registered. */
  setStatus(key: string, status: PrincipalStatus): boolean
  /** Unknown keys are not active; that is the point of asking. */
  active(key: string): boolean
}

export const makePrincipalRegistry = (options: { readonly now?: () => number } = {}): PrincipalRegistry => {
  const now = options.now ?? (() => Date.now())
  const records = new Map<string, PrincipalRecord>()

  const register = ({ kind, id, displayName }: RegisterPrincipalInput): PrincipalRecord => {
    const key = principalKey({ kind, id })
    const existing = records.get(key)
    const record: PrincipalRecord = {
      kind,
      id,
      status: "active",
      createdAt: existing?.createdAt ?? now(),
      ...(displayName === undefined ? {} : { displayName }),
    }
    records.set(key, record)
    return record
  }

  const setStatus = (key: string, status: PrincipalStatus): boolean => {
    const record = records.get(key)
    if (record === undefined) return false
    records.set(key, { ...record, status })
    return true
  }

  return {
    register,
    get: (key) => records.get(key),
    list: () => [...records.values()],
    setStatus,
    active: (key) => records.get(key)?.status === "active",
  }
}
