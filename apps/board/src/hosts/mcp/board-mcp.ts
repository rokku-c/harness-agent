import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { invoke } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { BoardApi } from "../../board.ts"
import { makeBoardTools } from "../../tools.ts"

export const makeBoardMcp = (board: BoardApi): McpServer => {
  const server = new McpServer({ name: "board", version: "1.0.0" })
  const register = server.registerTool.bind(server) as (name: string, config: {
    description?: string; inputSchema: Record<string, z.ZodType>,
  }, handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>) => void
  for (const tool of makeBoardTools(board)) register(tool.name, {
    description: tool.description, inputSchema: (tool.input as z.ZodObject).shape,
  }, async (args) => {
    try { return { content: [{ type: "text", text: JSON.stringify(await invoke(tool, args)) }] } }
    catch (error) { return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Board operation failed" }] } }
  })
  return server
}
