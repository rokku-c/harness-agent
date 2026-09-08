import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { McpGatewayServer, McpUpstream } from "./contract.ts"

export interface McpStdioUpstreamOptions { readonly servers: readonly McpGatewayServer[] }
const text = (result: { content?: readonly unknown[] }): string => (result.content ?? []).map((item) => {
  const value = item as { type?: string; text?: string }
  return value.type === "text" ? value.text ?? "" : ""
}).join("\n")

export const makeStdioUpstream = (options: McpStdioUpstreamOptions): McpUpstream & { close(): Promise<void> } => {
  const byId = new Map(options.servers.map((server) => [server.serverId, server]))
  const clients = new Map<string, Client>()
  const clientFor = async (server: McpGatewayServer): Promise<Client> => {
    const existing = clients.get(server.serverId); if (existing) return existing
    if (!server.command) throw new Error(`MCP server ${server.serverId} has no stdio command`)
    const client = new Client({ name: "effect-agent-mcp-gateway", version: "1.0.0" })
    const inherited = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
    const transport = new StdioClientTransport({ command: server.command, args: [...server.args ?? []], env: { ...inherited, ...server.env } })
    await client.connect(transport); clients.set(server.serverId, client); return client
  }
  return {
    async call(call) {
      const started = Date.now(), server = byId.get(call.serverId)
      if (!server) return { status: 404, ok: false, detail: "MCP server not found", durationMs: Date.now() - started }
      try {
        const result = await (await clientFor(server)).callTool({ name: call.tool, arguments: call.args as Record<string, unknown> | undefined })
        return { status: result.isError ? 502 : 200, ok: result.isError !== true, detail: text(result as unknown as { content?: readonly unknown[] }), durationMs: Date.now() - started }
      } catch (error) { return { status: 502, ok: false, detail: error instanceof Error ? error.message : "MCP stdio upstream failed", durationMs: Date.now() - started }
      }
    },
    async close() { for (const client of clients.values()) await client.close(); clients.clear() },
  }
}
