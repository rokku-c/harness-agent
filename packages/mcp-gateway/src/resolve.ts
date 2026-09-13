/**
 * mcp-gateway — turning a request into a principal.
 *
 * Three sources, in strict order. A bearer token is verified against the token
 * store; that is the only path an external caller can take. An already-parsed
 * claim bag (`authInfo.extra` from the transport's own auth layer) is trusted by
 * construction — the caller hands us claims, not headers. Raw `x-*` headers are
 * read only when the transport declares itself trusted, because anyone who can
 * reach the port can forge them.
 *
 * A request that presents a token but fails verification is denied outright
 * rather than falling through to the weaker sources — a fallback would let a
 * caller downgrade by sending a token it knows is bad.
 */

import type { Principal, PrincipalKind } from "@effect-agent/effect-authz"
import { isPrincipalKind, parsePrincipalKey } from "@effect-agent/effect-authz"

import { type HeaderBag, headerValue } from "./identity.ts"
import type { PrincipalRegistry } from "./principals.ts"
import type { TokenStore } from "./token.ts"

export interface ResolvePrincipalInput {
  readonly headers?: HeaderBag
  /** Declares the transport trustworthy, which is what lets bare headers count. */
  readonly trusted?: boolean
  readonly tokens?: TokenStore
  readonly principals?: PrincipalRegistry
  /** Claims the transport already validated; trusted by construction. */
  readonly claims?: Readonly<Record<string, unknown>>
}

export interface PrincipalResolution {
  readonly principal?: Principal
  readonly via?: "token" | "claim"
  /** Why resolution failed — present exactly when `principal` is absent. */
  readonly detail?: string
}

const BEARER = "bearer "
const KIND_CLAIM = "x-principal-kind"
const ID_CLAIM = "x-principal-id"

const bearerToken = (headers: HeaderBag): string | undefined => {
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
    if (registry !== undefined && !registry.active(`${kind}:${id}`)) return { detail: "principal is not active" }
    return { principal: { kind, id }, via }
  }

  const token = bearerToken(input.headers ?? {})
  if (token !== undefined) {
    const record = input.tokens?.verify(token)
    if (record === undefined) return { detail: "invalid token" }
    const principal = parsePrincipalKey(record.principalKey)
    if (principal === undefined) return { detail: "token carries no usable principal" }
    return settle(principal.kind, principal.id, "token")
  }

  const claims = input.claims
  if (claims !== undefined) {
    const given = claim((name) => (typeof claims[name] === "string" ? (claims[name] as string) : undefined))
    if (given !== undefined) return settle(given.kind, given.id, "claim")
  }

  if (input.trusted !== true) return { detail: "no credentials" }
  const headers = input.headers ?? {}
  const sent = claim((name) => headerValue(headers, name))
  if (sent === undefined) return { detail: "no credentials" }
  return settle(sent.kind, sent.id, "claim")
}
