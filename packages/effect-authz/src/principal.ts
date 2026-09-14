export type PrincipalKind = "user" | "app" | "system"

export interface Principal {
  readonly kind: PrincipalKind
  readonly id: string
  readonly claims?: Readonly<Record<string, unknown>>
}

export const principalKey = (principal: Principal): string => `${principal.kind}:${principal.id}`

export const isPrincipalKind = (value: string): value is PrincipalKind =>
  value === "user" || value === "app" || value === "system"

export const parsePrincipalKey = (key: string): Principal | undefined => {
  const at = key.indexOf(":")
  if (at <= 0) return undefined
  const kind = key.slice(0, at)
  const id = key.slice(at + 1)
  if (!isPrincipalKind(kind) || id.length === 0) return undefined
  return { kind, id }
}
