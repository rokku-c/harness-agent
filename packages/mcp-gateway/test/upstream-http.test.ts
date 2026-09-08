import { expect, test } from "bun:test"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { makeStreamableHttpUpstream } from "../src/index.ts"

test("streamable-http upstream uses the injected platform fetch", async () => {
  const mcp = new McpServer({ name: "upstream", version: "1" })
  mcp.registerTool("echo", { inputSchema: { text: z.string() } }, async ({ text }) => ({ content: [{ type: "text", text }] }))
  const server = Bun.serve({ port: 0, fetch: serveMcpHttp(() => Promise.resolve(mcp)) })
  let sent = 0
  const upstream = makeStreamableHttpUpstream({ servers: [{ serverId: "remote", transport: "streamable-http", endpoint: server.url.toString() }], fetch: (input, init) => { sent++; return fetch(input, init) } })
  try {
    const result = await upstream.call({ serverId: "remote", tool: "echo", args: { text: "hello" } })
    expect(result.ok).toBe(true); expect(result.status).toBe(200); expect(result.detail).toContain("hello"); expect(sent).toBeGreaterThan(0)
  } finally { await upstream.close(); server.stop(true) }
})
