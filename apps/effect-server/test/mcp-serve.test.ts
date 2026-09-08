import { expect, test } from "bun:test"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { buildRegistryMcpServer } from "../src/mcp-serve.ts"

test("registered interfaces are served as a real MCP server (tools/list + tools/call)", async () => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: "apps/demo",
    tools: [
      {
        name: "echo",
        description: "echo text back",
        // JSON-Schema-only tool (no zod) — like one discovered over MCP
        inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        handler: async (args) => {
          const text = (args as { text: string }).text
          return { text }
        },
      },
    ],
  })

  const server = buildRegistryMcpServer(registry)
  const pair = InMemoryTransport.createLinkedPair()
  await server.connect(pair[0])

  const client = new Client({ name: "effect-test", version: "0.0.0" })
  await client.connect(pair[1])

  const tools = await client.listTools()
  expect(tools.tools.map((t) => t.name)).toEqual(["apps_demo_echo"])

  const result = await client.callTool({ name: "apps_demo_echo", arguments: { text: "hello mcp" } })
  const text = Array.isArray(result.content) ? result.content.map((c) => ("text" in c ? c.text : "")).join("") : ""
  expect(text).toContain("hello mcp")

  await client.close()
})
