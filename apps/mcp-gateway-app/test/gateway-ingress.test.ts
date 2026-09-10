import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { createMcpGatewayPlugin } from "../src/effect-plugin.ts"

const server = { serverId: "files", name: "files", version: "1", era: "modern" as const, transport: { kind: "streamable-http" as const, endpoint: "http://files.invalid/mcp" } }
const config = { sets: [{ setId: "safe", name: "Safe", servers: ["files"] }], bindings: [{ agentId: "agent-1", setIds: ["safe"] }], defaultAction: "deny" as const, captureArgs: false }

test("gateway resolves a server from the shared registry and exposes topology", async () => {
  const registry = makeRegistry(), host = makePluginHost()
  registry.register(server)
  await host.register({ ...createMcpGatewayPlugin(() => config, { mcpRegistry: registry, fetch }), routes: [{ path: "/mcp-gateway", match: "prefix" }] })
  const topology = await host.handle(new Request("http://host/mcp-gateway"))
  expect(await topology.json()).toMatchObject({ servers: [{ serverId: "files" }], sets: config.sets, bindings: config.bindings })
  expect((await host.handle(new Request("http://host/mcp-gateway/call", { method: "POST" }))).status).toBe(404)
  await host.close()
})

test("gateway app plane does not own a listener", async () => {
  const registry = makeRegistry(), plugin = createMcpGatewayPlugin(() => ({ sets: [], bindings: [], defaultAction: "deny", captureArgs: false }), { mcpRegistry: registry, fetch })
  const plane = await plugin.load()
  expect("listen" in plane).toBe(false)
  await plane.stop?.()
})
