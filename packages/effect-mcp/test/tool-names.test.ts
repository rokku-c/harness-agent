import { expect, test } from "bun:test"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeEffectRegistry, type EffectInterface } from "@effect-agent/effect-interface"
import { buildNodeMcpServer } from "../src/index.ts"

const iface = (id: string, ...names: string[]): EffectInterface => ({
  id,
  tools: names.map((name) => ({
    name,
    description: name,
    inputSchema: { type: "object", properties: { id: { type: "string" } } },
    handler: async (args: unknown) => ({ received: args, tool: name }),
  })),
})

const build = (...ifaces: EffectInterface[]) => {
  const registry = makeEffectRegistry()
  for (const entry of ifaces) registry.registerInterface(entry)
  return buildNodeMcpServer(registry)
}

/** The tool names a connected agent is served. */
const servedNames = async (server: ReturnType<typeof build>): Promise<readonly string[]> => {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "probe", version: "0.1.0" })
  await server.connect(serverSide)
  await client.connect(clientSide)
  try {
    return (await client.listTools()).tools.map((tool) => tool.name)
  } finally {
    await client.close().catch(() => undefined)
  }
}

test("a tool is served under a name MCP accepts, and the call reaches it", async () => {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair()
  const server = build(iface("board", "task.open"))
  const client = new Client({ name: "probe", version: "0.1.0" })
  await server.connect(serverSide)
  await client.connect(clientSide)
  try {
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["task_open"])
    const result = await client.callTool({ name: "task_open", arguments: { id: "t1" } })
    expect(JSON.parse((result.content as Array<{ text: string }>)[0]!.text)).toEqual({
      received: { id: "t1" },
      tool: "task.open",
    })
  } finally {
    await client.close().catch(() => undefined)
  }
})

test("the surface is what the registry held when the server was built", async () => {
  const registry = makeEffectRegistry()
  registry.registerInterface(iface("board", "echo"))
  const server = buildNodeMcpServer(registry)
  registry.registerInterface(iface("late", "ping"))

  expect(await servedNames(server)).toEqual(["echo"])
})

test("two tools that would share one served name are refused, naming both", () => {
  expect(() => build(iface("board", "task.open"), iface("other", "task/open"))).toThrow(
    /"board\.task\.open" and "other\.task\/open" both serve as "task_open"/,
  )
})
