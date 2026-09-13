/**
 * What the identity operations read and write, and how a form's text becomes a
 * value the stores accept.
 *
 * A console field is text, and none of it is data until it has been checked:
 * a box left empty is an unanswered question rather than the empty string, a
 * number of days is a whole number or a refusal the operator can read, and an
 * identity is a kind and an id — never an id alone, which is ambiguous between a
 * user and an app of the same name and would resolve to nobody.
 */
import { isPrincipalKind, type PrincipalKind } from "@effect-agent/effect-authz"
import { OperationFault } from "@effect-agent/effect-interface"
import type { PrincipalRegistry, TokenStore } from "@effect-agent/mcp-gateway"

export interface IdentitySurfaces {
  readonly principals: PrincipalRegistry
  readonly tokens: TokenStore
}

/** A form's empty box is an unanswered question, not the empty string. */
export const given = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === "" ? undefined : trimmed
}

/** Days as a whole number, or no expiry at all; anything else is a refusal the operator can read. */
export const ttlMs = (value: string | number | undefined): number | undefined => {
  const days = given(value === undefined ? undefined : String(value))
  if (days === undefined) return undefined
  const count = Number(days)
  if (!Number.isInteger(count) || count <= 0) throw new OperationFault(400, `${days} is not a whole number of days`)
  return count * 86_400_000
}

/** Every operation that addresses an identity names it the same way, and refuses an unnamed one the same way. */
export const identityOf = (kind: string, id: string | undefined): { kind: PrincipalKind; id: string } => {
  if (id === undefined) throw new OperationFault(400, "an identity id is required")
  if (!isPrincipalKind(kind)) throw new OperationFault(400, `"${kind}" is not a principal kind; write the identity as a kind and an id, e.g. app:${id}`)
  return { kind, id }
}
