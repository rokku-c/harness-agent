import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "@effect-agent/effect-config"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { makeGatewayConfigAdapter } from "@effect-agent/agentd"
import { registryFixture } from "./registry-fixture.ts"

// One end-to-end contract, not a matrix of duplicate unit tests.
test("standard MCP config -> shared Registry lease -> Gateway -> real upstream, withdraw denies next call", async () => {
  let executed = 0
  const upstream = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: serveMcpHttp(async () => {
    const mcp = new McpServer({ name: "echo", version: "1" })
    const register = mcp.registerTool.bind(mcp) as Function
    register("echo", { inputSchema: { text: z.string() } }, async ({ text }: { text: string }) => {
      executed++; return { content: [{ type: "text", text }] }
    })
    return mcp
  }) })
  const f = await registryFixture(), client = new Client({ name: "agentd-client", version: "1" })
  try {
    const agent = { agentId: "agent-1", machineId: "machine", kind: "gateway", version: "1", status: "online" as const }
    const plan = makeGatewayConfigAdapter(new URL("/mcp-gateway", f.url).href).plan(agent, { agent, revision: 1,
      sets: [{ setId: "coding", name: "Coding", servers: ["echo"] }], servers: [] })
    const config = plan.desired.mcpServers.effectGateway
    await client.connect(new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } }))
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["mcp_gateway_call"])
    const call = () => client.callTool({ name: "mcp_gateway_call", arguments: { setId: "coding", tool: "echo", args: { text: "shared-result" } } })
    expect((await call()).isError).toBe(true)
    const lease = (path: string, method: string, body?: unknown, token = f.token) => fetch(new URL(path, f.url), {
      method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const server = { serverId: "echo", name: "Echo", version: "1", era: "modern",
      transport: { kind: "streamable-http", endpoint: upstream.url.href } }
    expect((await lease("/-/registry/announce", "POST", server, "bad")).status).toBe(403)
    expect((await lease("/-/registry/announce", "POST", server)).status).toBe(201)
    expect(f.app.mcpRegistry.get("echo")?.transport.endpoint).toBe(upstream.url.href)
    expect((await lease("/-/registry/heartbeat", "POST", { serverId: "echo", at: 99999999999999 })).status).toBe(400)
    expect((await lease("/-/registry/heartbeat", "POST", { serverId: "echo" })).status).toBe(200)
    const result = await call()
    expect(result.isError).toBe(false)
    const content = result.content as Array<{ type: string; text: string }>
    expect(JSON.parse(content[0].text)).toMatchObject({ ok: true, serverId: "echo", detail: "shared-result" })
    expect((await lease("/-/registry/echo", "DELETE")).status).toBe(204)
    expect((await call()).isError).toBe(true)
    expect(executed).toBe(1)
    expect((await fetch(new URL("/mcp-gateway/call", f.url), { method: "POST" })).status).toBe(404)
    expect((await fetch(new URL("/mcp", f.url))).status).toBe(404)
  } finally { await client.close(); await f.close(); upstream.stop(true) }
})
