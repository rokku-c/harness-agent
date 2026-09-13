import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import type { McpSetFacts, McpSetSlot } from "@effect-agent/mcp-gateway"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { createMcpGatewayPlugin } from "../src/effect-plugin.ts"

const server = { serverId: "files", name: "files", version: "1", era: "modern" as const, transport: { kind: "streamable-http" as const, endpoint: "http://files.invalid/mcp" } }
const config = { databaseFile: ":memory:", captureArgs: false }
const sets = [{ setId: "safe", name: "Safe", servers: ["files"] }]
const bindings = [{ agentId: "app:agent-1", setIds: ["safe"] }]
/**
 * What the agentd center hands the door: a reader over its own state, which is
 * why a binding written over there is visible here without anything copying it.
 */
const centerOf = (facts: () => McpSetFacts): McpSetSlot => ({ provide: () => {}, source: () => ({ facts }) })

test("gateway resolves a server from the shared registry and exposes the center's topology", async () => {
  const registry = makeRegistry(), host = makePluginHost()
  registry.register(server)
  const context = { mcpRegistry: registry, mcpSets: centerOf(() => ({ revision: 1, sets, bindings })), fetch }
  await host.register({ ...createMcpGatewayPlugin(() => config, context), routes: [{ path: "/mcp-gateway", match: "prefix" }] })
  const topology = await host.handle(new Request("http://host/mcp-gateway"))
  expect(await topology.json()).toMatchObject({ servers: [{ serverId: "files" }], sets, bindings })
  expect((await host.handle(new Request("http://host/mcp-gateway/call", { method: "POST" }))).status).toBe(404)
  await host.close()
})

test("a binding written after the door loaded is the binding it serves", async () => {
  const registry = makeRegistry(), host = makePluginHost()
  registry.register(server)
  let facts = { revision: 1, sets, bindings: [] as typeof bindings }
  const context = { mcpRegistry: registry, mcpSets: centerOf(() => facts), fetch }
  await host.register({ ...createMcpGatewayPlugin(() => config, context), routes: [{ path: "/mcp-gateway", match: "prefix" }] })
  const read = async () => (await (await host.handle(new Request("http://host/mcp-gateway"))).json() as { bindings: unknown }).bindings
  // The defect this replaces: a set bound in the center, and a console on this
  // side reading a copy of a config nobody had written to.
  expect(await read()).toEqual([])
  facts = { revision: 2, sets, bindings }
  expect(await read()).toEqual(bindings)
  await host.close()
})

test("gateway app plane does not own a listener", async () => {
  const registry = makeRegistry(), context = { mcpRegistry: registry, mcpSets: centerOf(() => ({ revision: 1, sets: [], bindings: [] })), fetch }
  const plane = await createMcpGatewayPlugin(() => config, context).load()
  expect("listen" in plane).toBe(false)
  await plane.stop?.()
})
