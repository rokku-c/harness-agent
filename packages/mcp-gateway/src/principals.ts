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
  setStatus(key: string, status: PrincipalStatus): boolean
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
