import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { effectApp } from "../src/effect-app.ts"

const config = {
  servers: [{ serverId: "gateway", name: "Gateway", version: "1", era: "modern", endpoint: "https://mcp.example.test", capabilities: { tools: 2 }, apps: [] }],
  registrationTokens: {},
}

test("uses the injected registry for both catalog and registry routes", async () => {
  const registry = makeRegistry()
  registry.register({ serverId: "external", name: "External", version: "1", era: "modern", transport: { kind: "streamable-http", endpoint: "https://external.example.test" } })
  const host = makePluginHost()
  const plugin = effectApp.createPlugin?.(() => config, { fetch, mcpRegistry: registry })
  await host.register({ ...plugin!, routes: effectApp.routes })

  const catalog = await host.handle(new Request("http://host/mcp-registry"))
  const servers = await host.handle(new Request("http://host/-/registry/servers"))
  const catalogBody = await catalog.json() as { servers: Array<{ serverId: string }>; summary: { total: number } }
  const serversBody = await servers.json() as { servers: Array<{ serverId: string; transport: { kind: string } }> }
  expect(catalogBody.servers.map((server) => server.serverId).sort()).toEqual(["external", "gateway"])
  expect(catalogBody.summary.total).toBe(2)
  expect(serversBody.servers.find((server) => server.serverId === "gateway")?.transport.kind).toBe("streamable-http")

  await host.close()
  expect(registry.get("external")).toBeDefined()
  expect(registry.get("gateway")).toBeUndefined()
})

test("previews a declared ui:// resource over the registered MCP endpoint", async () => {
  const html = "<!doctype html><h1>Registry preview</h1>"
  const upstream = new McpServer({ name: "preview", version: "1" })
  upstream.registerResource("console", "ui://preview/console", { mimeType: "text/html" }, async () => ({
    contents: [{ uri: "ui://preview/console", mimeType: "text/html", text: html }],
  }))
  const bun = Bun.serve({ port: 0, fetch: serveMcpHttp(upstream) })
  const registry = makeRegistry()
  registry.register({ serverId: "preview", name: "Preview", version: "1", era: "modern",
    transport: { kind: "streamable-http", endpoint: new URL("/mcp", bun.url).href }, apps: ["ui://preview/console"] })
  const host = makePluginHost()
  const plugin = effectApp.createPlugin?.(() => ({ ...config, servers: [] }), { fetch, mcpRegistry: registry })
  await host.register({ ...plugin!, routes: effectApp.routes })
  try {
    const response = await host.handle(new Request("http://host/-/registry/preview?serverId=preview&uri=ui%3A%2F%2Fpreview%2Fconsole"))
    expect(await response.json()).toEqual({ uri: "ui://preview/console", mimeType: "text/html", kind: "html", body: html })
    const denied = await host.handle(new Request("http://host/-/registry/preview?serverId=preview&uri=ui%3A%2F%2Fother%2Fconsole"))
    expect(denied.status).toBe(502)
  } finally {
    await host.close()
    bun.stop(true)
  }
})
