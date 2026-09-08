/**
 * Test-only stdio MCP server: a tiny "plugin" that registers over stdio,
 * proving stdio plugin registration through the MCP client.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({ name: "time-server", version: "1.0.0" })
const register = server.registerTool.bind(server) as (
  name: string,
  config: { title?: string; description?: string; inputSchema?: unknown },
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }> }>,
) => void

register(
  "now",
  { title: "Now", description: "Current unix milliseconds", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: String(Date.now()) }] }),
)

register(
  "echo",
  { title: "Echo", description: "Echo text back", inputSchema: { text: z.string() } },
  async ({ text }: Record<string, unknown>) => ({ content: [{ type: "text", text: String(text) }] }),
)

await server.connect(new StdioServerTransport())
