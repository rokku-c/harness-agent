import { expect, test } from "bun:test"

import { makeAuthz, principalKey, type Principal } from "@effect-agent/effect-authz"

import { makeToolCatalog, type McpToolSurface, resolveSurfacePrincipal, surfaceTarget, surfaceTools } from "../src/index.ts"
import { make } from "./fixtures.ts"

const alice: Principal = { kind: "user", id: "alice" }
const key = principalKey(alice)

const catalogWith = () => {
  const catalog = makeToolCatalog()
  catalog.replace("board", [{ name: "board_view", description: "View the board" }, { name: "board_create_item" }])
  catalog.replace("files", [{ name: "read", inputSchema: { type: "object", properties: {} } }])
  return catalog
}

const surfaceWith = (authz = makeAuthz()): McpToolSurface => ({ authz, catalog: catalogWith() })
const asAlice = { authInfo: { clientId: "cli", extra: { "x-principal-kind": "user", "x-principal-id": "alice" } } }

test("a caller with no credentials is shown nothing", () => {
  const surface = surfaceWith()
  expect(resolveSurfacePrincipal(surface, {}).principal).toBeUndefined()
  expect(surfaceTools(surface, resolveSurfacePrincipal(surface, {}))).toEqual([])
  expect(surfaceTools(surface, resolveSurfacePrincipal(surface, { headers: { "x-principal-kind": "system", "x-principal-id": "codex" } }))).toEqual([])
})

test("a caller sees exactly the tools its grants cover, in catalog order", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  const surface = surfaceWith(authz)
  const listed = surfaceTools(surface, resolveSurfacePrincipal(surface, asAlice))
  expect(listed.map((entry) => entry.name)).toEqual(["board.board_view", "board.board_create_item"])
  expect(listed[0]!.description).toBe("View the board")
})

test("an advertised tool keeps its upstream schema, or gets a permissive one", () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://**", actions: ["call"] })
  const surface = surfaceWith(authz)
  const listed = surfaceTools(surface, resolveSurfacePrincipal(surface, asAlice))
  expect(listed.find((entry) => entry.name === "files.read")?.inputSchema).toEqual({ type: "object", properties: {} })
  expect(listed.find((entry) => entry.name === "board.board_view")?.inputSchema).toEqual({ type: "object", additionalProperties: true })
})

test("an advertised name resolves back to the upstream tool it stands for", () => {
  const surface = surfaceWith()
  expect(surfaceTarget(surface, "board.board_view")).toMatchObject({ serverId: "board", tool: "board_view" })
  expect(surfaceTarget(surface, "board.ghost")).toBeUndefined()
  expect(surfaceTarget(surface, "mcp_gateway_call")).toBeUndefined()
})

test("what a caller is shown is exactly what it may call", async () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  authz.grant({ subject: key, resource: "mcp://files/read", actions: ["call"], effect: "deny" })
  const surface = surfaceWith(authz)
  const { gateway } = make(undefined, undefined, { authz })
  const listed = surfaceTools(surface, resolveSurfacePrincipal(surface, asAlice)).map((entry) => entry.name)
  for (const entry of surface.catalog.list()) {
    const result = await gateway.handle({ callId: `s-${entry.advertised}`, principal: alice, serverId: entry.serverId, tool: entry.tool })
    expect(result.ok).toBe(listed.includes(entry.advertised))
  }
  expect(listed).toEqual(["board.board_view", "board.board_create_item"])
})

test("the same request that lists a tool is refused when it calls a hidden one", async () => {
  const authz = makeAuthz()
  authz.grant({ subject: key, resource: "mcp://board/*", actions: ["call"] })
  const { gateway } = make(undefined, undefined, { authz })
  const hidden = surfaceTarget(surfaceWith(authz), "files.read")!
  const result = await gateway.handle({ callId: "s-hidden", principal: alice, serverId: hidden.serverId, tool: hidden.tool })
  expect(result).toMatchObject({ ok: false, status: 403, detail: "denied_by_principal" })
})
