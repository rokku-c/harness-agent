import { isPrincipalKind, type PrincipalKind } from "@effect-agent/effect-authz"
import { OperationFault } from "@effect-agent/effect-interface"
import type { PrincipalRegistry, TokenStore } from "@effect-agent/mcp-gateway"

export interface IdentitySurfaces {
  readonly principals: PrincipalRegistry
  readonly tokens: TokenStore
}

export const given = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === "" ? undefined : trimmed
}

export const ttlMs = (value: string | number | undefined): number | undefined => {
  const days = given(value === undefined ? undefined : String(value))
  if (days === undefined) return undefined
  const count = Number(days)
  if (!Number.isInteger(count) || count <= 0) throw new OperationFault(400, `${days} is not a whole number of days`)
  return count * 86_400_000
}

export const identityOf = (kind: string, id: string | undefined): { kind: PrincipalKind; id: string } => {
  if (id === undefined) throw new OperationFault(400, "an identity id is required")
  if (!isPrincipalKind(kind)) throw new OperationFault(400, `"${kind}" is not a principal kind; write the identity as a kind and an id, e.g. app:${id}`)
  return { kind, id }
}
