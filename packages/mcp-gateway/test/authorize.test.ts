import { expect, test } from "bun:test"

import { makeAuthz, principalKey, type Principal } from "@effect-agent/effect-authz"

import { authorizeCall, type ToolRef } from "../src/index.ts"

const catalog: readonly ToolRef[] = [
  { serverId: "board", tool: "board_view" },
  { serverId: "board", tool: "board_create_item" },
  { serverId: "files", tool: "read" },
]
const alice: Principal = { kind: "user", id: "alice" }
const key = principalKey(alice)

test("a principal with no grants may call nothing", () => {
  const authz = makeAuthz()
  for (const ref of catalog) expect(authorizeCall(authz, { principal: alice, ...ref }).refusal).toBe("denied")
})

test("a server grant opens exactly that server's tools", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  expect(authorizeCall(authz, { principal: alice, serverId: "board", tool: "board_view" }).allowed).toBe(true)
  expect(authorizeCall(authz, { principal: alice, serverId: "board", tool: "board_create_item" }).allowed).toBe(true)
  expect(authorizeCall(authz, { principal: alice, serverId: "files", tool: "read" }).allowed).toBe(false)
})

test("an explicit deny outranks a blanket allow", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  authz.grant({ subject: key, resource: "mcp://board/board_view", actions: ["call"], effect: "deny" })
  expect(authorizeCall(authz, { principal: alice, serverId: "board", tool: "board_view" }).allowed).toBe(false)
  expect(authorizeCall(authz, { principal: alice, serverId: "board", tool: "board_create_item" }).allowed).toBe(true)
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
