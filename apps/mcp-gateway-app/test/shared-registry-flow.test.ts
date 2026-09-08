import { expect, test } from "bun:test"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeConfigRegistry, makeSqliteConfigStore } from "@effect-agent/effect-config"
import { makeEgressRouter } from "@effect-agent/effect-network"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { effectApp as gatewayApp } from "../src/effect-app.ts"
import { effectApp as registryApp } from "../../mcp-registry-app/src/effect-app.ts"

test("gateway and registry apps share topology and call a live MCP server", async () => {
  const upstream = new McpServer({ name: "echo", version: "1" })
  upstream.registerTool("echo", { inputSchema: { text: z.string() } }, async ({ text }) => ({ content: [{ type: "text", text }] }))
  const server = Bun.serve({ port: 0, fetch: serveMcpHttp(() => Promise.resolve(upstream)) })
  const host = makePluginHost(), configs = makeConfigRegistry({ store: makeSqliteConfigStore({ file: ":memory:" }) })
  const mcpRegistry = makeRegistry(), network = makeEgressRouter({ role: "main" })
  const shared = { host, configs, mcpRegistry, network, registry: makeEffectRegistry(), initializeConfig: (id: string) => configs.initialize(id, { yaml: id === "mcp-registry" ? { servers: [{ serverId: "echo", name: "echo", version: "1", era: "modern", endpoint: server.url.toString(), apps: [] }] } : { sets: [{ setId: "coding", name: "Coding", servers: ["echo"], allowTools: ["echo"] }], bindings: [{ agentId: "agent-1", setIds: ["coding"] }], defaultAction: "allow", captureArgs: false } }), activeConfig: (id: string) => configs.read(id).value }
  try {
    const gateway = await registerEffectApp(shared, gatewayApp), registry = await registerEffectApp(shared, registryApp)
    const response = await host.handle(new Request("http://host/mcp-gateway/call", { method: "POST", headers: { "content-type": "application/json", "x-agent-id": "agent-1" }, body: JSON.stringify({ setId: "coding", tool: "echo", args: { text: "shared" } }) }))
    expect(response.status).toBe(200)
    expect((await response.json()).detail).toContain("shared")
    await registry(); await gateway()
  } finally { await host.close(); configs.close(); server.stop(true) }
})
