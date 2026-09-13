import { expect, test } from "bun:test"

import { makePrincipalRegistry, makeTokenStore, resolvePrincipal } from "../src/index.ts"

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

test("a live bearer token resolves to its principal", () => {
  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: "app:billing-sync" })
  const resolution = resolvePrincipal({ headers: bearer(token), tokens })
  expect(resolution.principal).toEqual({ kind: "app", id: "billing-sync" })
  expect(resolution.via).toBe("token")
  expect(resolution.detail).toBeUndefined()
})

test("a request with no credentials names no principal", () => {
  const resolution = resolvePrincipal({ headers: {}, tokens: makeTokenStore() })
  expect(resolution.principal).toBeUndefined()
  expect(resolution.detail).toBeDefined()
})

test("a bad token is denied, never downgraded to claims", () => {
  const resolution = resolvePrincipal({
    headers: { ...bearer("t_forged"), "x-principal-kind": "system", "x-principal-id": "codex-sync" },
    tokens: makeTokenStore(),
    trusted: true,
  })
  expect(resolution.principal).toBeUndefined()
  expect(resolution.via).toBeUndefined()
})

test("a revoked token stops resolving even though its principal lives", () => {
  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: "user:alice" })
  tokens.revoke(token)
  expect(resolvePrincipal({ headers: bearer(token), tokens }).principal).toBeUndefined()
})

test("claims are ignored unless the transport is trusted", () => {
  const headers = { "x-principal-kind": "system", "x-principal-id": "codex-sync" }
  expect(resolvePrincipal({ headers }).principal).toBeUndefined()
  expect(resolvePrincipal({ headers, trusted: false }).principal).toBeUndefined()
  expect(resolvePrincipal({ headers, trusted: true }).principal).toEqual({ kind: "system", id: "codex-sync" })
})

test("pre-validated claims resolve without any headers", () => {
  const resolution = resolvePrincipal({
    trusted: true,
    claims: { "x-principal-kind": "user", "x-principal-id": "alice" },
  })
  expect(resolution).toEqual({ principal: { kind: "user", id: "alice" }, via: "claim" })
})

test("an unknown kind or an empty id is not a principal", () => {
  const trusted = true
  expect(resolvePrincipal({ trusted, headers: { "x-principal-kind": "robot", "x-principal-id": "r2" } }).principal).toBeUndefined()
  expect(resolvePrincipal({ trusted, headers: { "x-principal-kind": "user", "x-principal-id": "" } }).principal).toBeUndefined()
})

test("a disabled principal is refused on both paths", () => {
  const principals = makePrincipalRegistry()
  principals.register({ kind: "user", id: "alice" })
  principals.register({ kind: "app", id: "billing-sync" })
  principals.setStatus("user:alice", "disabled")

  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: "user:alice" })
  expect(resolvePrincipal({ headers: bearer(token), tokens, principals }).principal).toBeUndefined()

  const claims = { "x-principal-kind": "user", "x-principal-id": "alice" }
  expect(resolvePrincipal({ trusted: true, claims, principals }).principal).toBeUndefined()

  const active = tokens.issue({ principalKey: "app:billing-sync" })
  expect(resolvePrincipal({ headers: bearer(active.token), tokens, principals }).via).toBe("token")
})

test("a token outranks claims when a request carries both", () => {
  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: "user:alice" })
  const resolution = resolvePrincipal({
    headers: { ...bearer(token), "x-principal-kind": "system", "x-principal-id": "codex-sync" },
    tokens,
    trusted: true,
  })
  expect(resolution.principal).toEqual({ kind: "user", id: "alice" })
  expect(resolution.via).toBe("token")
})
