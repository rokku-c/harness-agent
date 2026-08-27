import { describe, expect, test } from "bun:test"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Effect } from "effect"
import { z } from "zod"
import { ConnectionRuntime } from "@effect-agent/core"
import { McpCapabilities, mcpConnectionSpec, mcpSdkAdapter } from "@effect-agent/builtin"

describe("official MCP SDK adapter", () => {
  test("negotiates the protocol and invokes tools over an injected transport", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = new McpServer({ name: "test-server", version: "1.0.0" })
    server.registerTool("echo", { description: "Echo text", inputSchema: { text: z.string() } }, async (args) => ({
      content: [{ type: "text", text: String(args.text ?? "") }]
    }))
    await server.connect(serverTransport)

    const adapter = mcpSdkAdapter({
      kind: "test.mcp.memory",
      createTransport: () => Effect.succeed(clientTransport)
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [mcpConnectionSpec({ id: "tools", adapters: [{ kind: adapter.kind }] })],
      adapters: [adapter]
    }))

    const listed = await Effect.runPromise(runtime.invoke("tools", McpCapabilities.toolsList, {})) as any
    expect(listed.tools.map((tool: any) => tool.name)).toEqual(["echo"])

    const called = await Effect.runPromise(runtime.invoke("tools", McpCapabilities.toolsCall, {
      name: "echo",
      arguments: { text: "official SDK" }
    })) as any
    expect(called.content).toEqual([{ type: "text", text: "official SDK" }])
    expect((await Effect.runPromise(runtime.open("tools"))).capabilities.has(McpCapabilities.toolsCall)).toBe(true)

    await Effect.runPromise(runtime.close("tools"))
    await server.close()
  })
})
