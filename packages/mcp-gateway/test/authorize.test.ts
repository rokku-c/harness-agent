import { expect, test } from "bun:test"

import { makeAuthz, principalKey, type Principal } from "@effect-agent/effect-authz"

import { authorizeCall, type ToolRef, visibleToolRefs } from "../src/index.ts"

const catalog: readonly ToolRef[] = [
  { serverId: "board", tool: "board_view" },
  { serverId: "board", tool: "board_create_item" },
  { serverId: "files", tool: "read" },
]
const alice: Principal = { kind: "user", id: "alice" }
const key = principalKey(alice)

test("a principal with no grants sees nothing and may call nothing", () => {
  const authz = makeAuthz()
  expect(visibleToolRefs(authz, alice, catalog)).toEqual([])
  for (const ref of catalog) expect(authorizeCall(authz, { principal: alice, ...ref }).refusal).toBe("denied")
})

test("a server grant opens exactly that server's tools", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  expect(visibleToolRefs(authz, alice, catalog)).toEqual(catalog.slice(0, 2))
  expect(authorizeCall(authz, { principal: alice, serverId: "board", tool: "board_view" }).allowed).toBe(true)
  expect(authorizeCall(authz, { principal: alice, serverId: "files", tool: "read" }).allowed).toBe(false)
})

test("the projected list and the direct call always agree", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "**", actions: ["call"] })
  authz.grant({ subject: key, resource: "mcp://files/*", actions: ["call"], effect: "deny" })
  const visible = visibleToolRefs(authz, alice, catalog)
  for (const ref of catalog) {
    const callable = authorizeCall(authz, { principal: alice, ...ref }).allowed
    expect(callable).toBe(visible.includes(ref))
  }
  expect(visible).toEqual(catalog.slice(0, 2))
})

test("an explicit deny outranks a blanket allow", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  authz.grant({ subject: key, resource: "mcp://board/board_view", actions: ["call"], effect: "deny" })
  expect(visibleToolRefs(authz, alice, catalog)).toEqual([catalog[1]!])
})

test("a grant to another principal does not reach this one", () => {
  const authz = makeAuthz()
  authz.grant({ subject: "user:bob", resource: "mcp://**", actions: ["call"] })
  expect(authorizeCall(authz, { principal: alice, serverId: "board", tool: "board_view" }).allowed).toBe(false)
})

test("an unresolved caller is refused even where a blanket allow exists", () => {
  const authz = makeAuthz()
  authz.grant({ subject: "*", resource: "**", actions: ["call"] })
  const refused = authorizeCall(authz, { serverId: "board", tool: "board_view" })
  expect(refused.allowed).toBe(false)
  expect(refused.refusal).toBe("no_principal")
  expect(refused.decision).toBeUndefined()
})

test("a tool-less call addresses the server, which sits above its tools", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  expect(authorizeCall(authz, { principal: alice, serverId: "board" }).allowed).toBe(false)
  authz.grant({ subject: key, resource: "mcp://board", actions: ["call"] })
  expect(authorizeCall(authz, { principal: alice, serverId: "board" }).allowed).toBe(true)
})

test("the projection keeps catalog order and drops duplicates once", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://**", actions: ["call"] })
  const reordered: readonly ToolRef[] = [catalog[2]!, catalog[0]!, catalog[2]!]
  expect(visibleToolRefs(authz, alice, reordered)).toEqual(reordered)
})
