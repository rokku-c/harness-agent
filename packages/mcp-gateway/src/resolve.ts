import { isPrincipalKind, parsePrincipalKey, principalKey, type Principal, type PrincipalKind } from "@effect-agent/effect-authz"

import { type HeaderBag, headerValue } from "./identity.ts"
import type { PrincipalRegistry } from "./principals.ts"
import type { TokenStore } from "./token.ts"

export interface ResolvePrincipalInput {
  readonly headers?: HeaderBag
  readonly trusted?: boolean
  readonly tokens?: TokenStore
  readonly principals?: PrincipalRegistry
  readonly claims?: Readonly<Record<string, unknown>>
}

export interface PrincipalResolution {
  readonly principal?: Principal
  readonly via?: "token" | "claim"
  readonly detail?: string
}

const BEARER = "bearer "
const KIND_CLAIM = "x-principal-kind"
const ID_CLAIM = "x-principal-id"

export const principalClaims = (principal: Principal): Readonly<Record<string, string>> => ({
  [KIND_CLAIM]: principal.kind,
  [ID_CLAIM]: principal.id,
})

export const bearerToken = (headers: HeaderBag): string | undefined => {
  const raw = headerValue(headers, "authorization")
  if (raw === undefined || raw.length <= BEARER.length) return undefined
  return raw.slice(0, BEARER.length).toLowerCase() === BEARER ? raw.slice(BEARER.length) : undefined
}

interface Claimed {
  readonly kind: PrincipalKind
  readonly id: string
}

const claim = (read: (name: string) => string | undefined): Claimed | undefined => {
  const kind = read(KIND_CLAIM)
  const id = read(ID_CLAIM)
  if (kind === undefined || !isPrincipalKind(kind) || id === undefined || id.length === 0) return undefined
  return { kind, id }
}

export const resolvePrincipal = (input: ResolvePrincipalInput): PrincipalResolution => {
  const settle = (kind: Principal["kind"], id: string, via: "token" | "claim"): PrincipalResolution => {
    const registry = input.principals
    if (registry !== undefined && !registry.active(principalKey({ kind, id }))) return { detail: "principal is not active" }
    return { principal: { kind, id }, via }
  }

  const claims = input.claims
  if (claims !== undefined) {
    const given = claim((name) => (typeof claims[name] === "string" ? (claims[name] as string) : undefined))
    if (given !== undefined) return settle(given.kind, given.id, "claim")
  }

  const token = bearerToken(input.headers ?? {})
  if (token !== undefined) {
    const record = input.tokens?.verify(token)
    if (record === undefined) return { detail: "invalid token" }
    const principal = parsePrincipalKey(record.principalKey)
    if (principal === undefined) return { detail: "token carries no usable principal" }
    return settle(principal.kind, principal.id, "token")
  }

  if (input.trusted !== true) return { detail: "no credentials" }
  const headers = input.headers ?? {}
  const sent = claim((name) => headerValue(headers, name))
  if (sent === undefined) return { detail: "no credentials" }
  return settle(sent.kind, sent.id, "claim")
}
