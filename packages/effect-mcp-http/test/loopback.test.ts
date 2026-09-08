import { expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { buildNodeMcpServer } from "@effect-agent/effect-mcp"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

import { serveMcpHttp, type McpHttpHandler } from "../src/index.ts"

/** Build an effect-node MCP server exposing one tool: echo(text). */
const nodeMcpServer = () => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: "node",
    tools: [{
      name: "echo",
      description: "echo the text back",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (args: unknown) => ({ text: (args as { text: string }).text, via: "http" }),
    }],
  })
  return buildNodeMcpServer(registry)
}

const roundTrip = async (handler: McpHttpHandler): Promise<unknown> => {
  const bun = Bun.serve({ port: 0, fetch: handler })
  const client = new Client({ name: "loopback-client", version: "0.0.1" })
  try {
    const transport = new StreamableHTTPClientTransport(new URL("/mcp", bun.url))
    await client.connect(transport)
    const tools = await client.listTools()
    expect(tools.tools.map((t) => t.name)).toContain("echo")
    const call = await client.callTool({ name: "echo", arguments: { text: "over-http" } })
    const text = (call.content as Array<{ type: "text"; text: string }>)[0]?.text ?? ""
    expect(call.isError).toBeUndefined()
    return JSON.parse(text) as unknown
  } finally {
    await client.close().catch(() => undefined)
    bun.stop(true)
  }
}

test("loopback: fresh McpServer per request is reachable over remote streamable HTTP", async () => {
  const handler = serveMcpHttp(() => Promise.resolve(nodeMcpServer()))
  expect(await roundTrip(handler)).toEqual({ text: "over-http", via: "http" })
})

test("loopback: one shared McpServer instance is reused across the request cycle", async () => {
  const handler = serveMcpHttp(nodeMcpServer())
  expect(await roundTrip(handler)).toEqual({ text: "over-http", via: "http" })
})

test("GET (SSE) returns 405 JSON, so clients use POST-only JSON", async () => {
  const bun = Bun.serve({ port: 0, fetch: serveMcpHttp(() => Promise.resolve(nodeMcpServer())) })
  try {
    const res = await fetch(new URL("/mcp", bun.url), {
      method: "GET",
      headers: { Accept: "text/event-stream" },
    })
    expect(res.status).toBe(405)
    expect(res.headers.get("allow")).toBe("POST")
    const body = (await res.json()) as { error?: { message?: string } }
    expect(body.error?.message).toContain("POST JSON-RPC only")
  } finally {
    bun.stop(true)
  }
})
