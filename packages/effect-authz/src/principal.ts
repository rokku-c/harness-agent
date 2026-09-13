/**
 * effect-authz — the calling subject.
 *
 * A principal is what a request resolves to before any authorization happens:
 * a human user, an integrated app, or an autonomous system agent. The kind only
 * selects a default projection template (see templates.ts); it never grants
 * anything by itself.
 */

export type PrincipalKind = "user" | "app" | "system"

export interface Principal {
  readonly kind: PrincipalKind
  readonly id: string
  readonly claims?: Readonly<Record<string, unknown>>
}

/** Canonical key form, e.g. `user:alice`, `app:billing-sync`, `system:codex-sync`. */
export const principalKey = (principal: Principal): string => `${principal.kind}:${principal.id}`

export const isPrincipalKind = (value: string): value is PrincipalKind =>
  value === "user" || value === "app" || value === "system"

/** Inverse of `principalKey`; undefined when the key is malformed or unknown. */
export const parsePrincipalKey = (key: string): Principal | undefined => {
  const at = key.indexOf(":")
  if (at <= 0) return undefined
  const kind = key.slice(0, at)
  const id = key.slice(at + 1)
  if (!isPrincipalKind(kind) || id.length === 0) return undefined
  return { kind, id }
}
