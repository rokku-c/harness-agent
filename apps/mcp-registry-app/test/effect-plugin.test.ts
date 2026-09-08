import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeRegistry } from "@effect-agent/mcp-registry"
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
  const catalogBody = await catalog.json() as { servers: Array<{ serverId: string }> }
  const serversBody = await servers.json() as { servers: Array<{ serverId: string; transport: { kind: string } }> }
  expect(catalogBody.servers.map((server) => server.serverId).sort()).toEqual(["external", "gateway"])
  expect(serversBody.servers.find((server) => server.serverId === "gateway")?.transport.kind).toBe("streamable-http")

  await host.close()
  expect(registry.get("external")).toBeDefined()
  expect(registry.get("gateway")).toBeUndefined()
})
