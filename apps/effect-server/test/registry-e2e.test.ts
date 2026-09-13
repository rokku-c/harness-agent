import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "@effect-agent/effect-config"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { registryFixture } from "./registry-fixture.ts"

// One end-to-end contract, not a matrix of duplicate unit tests.
test("issued credential -> one door -> advertised catalog -> real upstream, withdraw denies the next call", async () => {
  let executed = 0
  const upstream = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: serveMcpHttp(async () => {
    const mcp = new McpServer({ name: "echo", version: "1" })
    const register = mcp.registerTool.bind(mcp) as Function
    register("echo", { inputSchema: { text: z.string() } }, async ({ text }: { text: string }) => {
      executed++; return { content: [{ type: "text", text }] }
    })
    return mcp
  }) })
  const f = await registryFixture()
  const connect = async (headers: Record<string, string>) => {
    const client = new Client({ name: "agentd-client", version: "1" })
    await client.connect(new StreamableHTTPClientTransport(new URL("/mcp-gateway", f.url), { requestInit: { headers } }))
    return client
  }
  const at = (path: string) => new URL(path, f.url)
  const lease = (path: string, method: string, body?: unknown, token = f.token) => fetch(at(path), {
    method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let client: Client | undefined, stranger: Client | undefined
  try {
    // The door names a caller only from a credential it verified, so an agent is
    // issued one first: an identity the operator can turn off, never a header.
    const issued = await fetch(at("/mcp-gateway/tokens"), { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "app", id: "agent-1" }) })
    expect(issued.status).toBe(201)
    const token = (await issued.json()).token as string

    const server = { serverId: "echo", name: "Echo", version: "1", era: "modern",
      transport: { kind: "streamable-http", endpoint: upstream.url.href } }
    // Nothing is registered yet, so the door offers nothing: no tool it cannot carry.
    client = await connect({ authorization: `Bearer ${token}` })
    expect((await client.listTools()).tools).toEqual([])

    expect((await lease("/-/registry/announce", "POST", server, "bad")).status).toBe(403)
    expect((await lease("/-/registry/announce", "POST", server)).status).toBe(201)
    expect(f.app.mcpRegistry.get("echo")?.transport.endpoint).toBe(upstream.url.href)
    expect((await lease("/-/registry/heartbeat", "POST", { serverId: "echo", at: 99999999999999 })).status).toBe(400)
    expect((await lease("/-/registry/heartbeat", "POST", { serverId: "echo" })).status).toBe(200)

    // What the door advertises is the upstream's own tool, under the name the
    // catalog keys it by — one flat tool, not a multiplexed call.
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["echo.echo"])
    const result = await client.callTool({ name: "echo.echo", arguments: { text: "shared-result" } })
    expect(result.isError).toBe(false)
    const content = result.content as Array<{ type: string; text: string }>
    expect(JSON.parse(content[0].text)).toMatchObject({ ok: true, serverId: "echo", setId: "coding", detail: "shared-result" })

    // The same door, reached without a credential: shown nothing, and carrying nothing.
    stranger = await connect({})
    expect((await stranger.listTools()).tools).toEqual([])
    const refused = await stranger.callTool({ name: "echo.echo", arguments: { text: "shared-result" } })
    expect(refused.isError).toBe(true)
    expect(JSON.parse((refused.content as Array<{ text: string }>)[0].text)).toMatchObject({ ok: false, status: 401 })
    expect(executed).toBe(1)

    expect((await lease("/-/registry/echo", "DELETE")).status).toBe(204)
    expect((await client.callTool({ name: "echo.echo", arguments: { text: "shared-result" } })).isError).toBe(true)
    expect(executed).toBe(1)
  } finally { await client?.close(); await stranger?.close(); await f.close(); upstream.stop(true) }
})
