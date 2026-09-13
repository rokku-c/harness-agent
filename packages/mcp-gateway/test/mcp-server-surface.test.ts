import { expect, test } from "bun:test"

import { makeAuthz, principalKey, type Principal } from "@effect-agent/effect-authz"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

import { buildMcpGatewayServer, makeToolCatalog, makeTokenStore, type McpToolSurface } from "../src/index.ts"
import { make } from "./fixtures.ts"

const alice: Principal = { kind: "user", id: "alice" }

const surfaceWith = (authz = makeAuthz()): McpToolSurface => {
  const catalog = makeToolCatalog()
  catalog.replace("board", [{ name: "board_view" }, { name: "board_create_item" }])
  catalog.replace("files", [{ name: "read" }])
  return { authz, catalog }
}

const grantBoard = (authz = makeAuthz()) => {
  authz.grant({ subject: principalKey(alice), resource: "mcp://board/*", actions: ["call"] })
  return authz
}

const asClient = async <T>(surface: McpToolSurface, headers: Record<string, string>, run: (client: Client) => Promise<T>): Promise<T> => {
  const { gateway } = make(undefined, undefined, { authz: surface.authz })
  const bun = Bun.serve({ port: 0, fetch: serveMcpHttp(() => Promise.resolve(buildMcpGatewayServer(gateway, surface))) })
  const client = new Client({ name: "surface-client", version: "0.0.0" })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", bun.url), { requestInit: { headers } }))
    return await run(client)
  } finally {
    await client.close().catch(() => undefined)
    bun.stop(true)
  }
}

test("over the wire, a bearer token decides which tools are advertised", async () => {
  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: principalKey(alice) })
  const surface = { ...surfaceWith(grantBoard()), tokens }
  const names = await asClient(surface, { authorization: `Bearer ${token}` }, async (client) =>
    (await client.listTools()).tools.map((entry) => entry.name))
  expect(names).toEqual(["board.board_view", "board.board_create_item"])
})

test("a caller with no credentials is advertised nothing", async () => {
  const names = await asClient(surfaceWith(grantBoard()), {}, async (client) => (await client.listTools()).tools.map((entry) => entry.name))
  expect(names).toEqual([])
})

test("a forged claim header is not credentials on its own", async () => {
  const surface = surfaceWith(grantBoard())
  const names = await asClient(surface, { "x-principal-kind": "user", "x-principal-id": "alice" }, async (client) =>
    (await client.listTools()).tools.map((entry) => entry.name))
  expect(names).toEqual([])
})

test("a tool that was listed can be called, and one that was hidden cannot", async () => {
  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: principalKey(alice) })
  const surface = { ...surfaceWith(grantBoard()), tokens }
  const outcome = await asClient(surface, { authorization: `Bearer ${token}` }, async (client) => ({
    listed: (await client.callTool({ name: "board.board_view", arguments: {} })).isError === true,
    hidden: await client.callTool({ name: "files.read", arguments: {} }).then((result) => result.isError === true, () => "threw"),
  }))
  expect(outcome).toEqual({ listed: false, hidden: true })
})

test("a name outside the catalog is not a gateway tool", async () => {
  const tokens = makeTokenStore()
  const { token } = tokens.issue({ principalKey: principalKey(alice) })
  const surface = { ...surfaceWith(grantBoard()), tokens }
  const thrown = await asClient(surface, { authorization: `Bearer ${token}` }, async (client) =>
    client.callTool({ name: "mcp_gateway_call", arguments: { tool: "board_view" } }).then(() => false, () => true))
  expect(thrown).toBe(true)
})
