import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport, type FetchLike } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpGatewayServer, McpUpstream } from "./contract.ts"

export interface McpHttpServer extends McpGatewayServer {
  readonly transport: "streamable-http" | "stdio"
  readonly endpoint: string
  readonly headers?: Readonly<Record<string, string>>
}
export interface McpHttpUpstreamOptions { readonly servers: readonly McpHttpServer[]; readonly fetch?: FetchLike }
const text = (result: { content?: readonly unknown[] }): string => (result.content ?? []).map((item) => {
  const value = item as { type?: string; text?: string }; return value.type === "text" ? value.text ?? "" : ""
}).join("\n")

/** Lazy MCP clients; every HTTP request uses the platform-supplied fetch. */
export const makeStreamableHttpUpstream = (options: McpHttpUpstreamOptions): McpUpstream & { close(): Promise<void> } => {
  const byId = new Map(options.servers.map((server) => [server.serverId, server])), clients = new Map<string, Client>()
  const clientFor = async (server: McpHttpServer): Promise<Client> => {
    if (server.transport !== "streamable-http") throw new Error(`MCP server ${server.serverId} is not streamable-http`)
    const existing = clients.get(server.serverId); if (existing) return existing
    const client = new Client({ name: "effect-agent-mcp-gateway", version: "1.0.0" })
    const transport = new StreamableHTTPClientTransport(new URL(server.endpoint), {
      fetch: options.fetch, requestInit: { headers: server.headers as Record<string, string> | undefined },
    })
    await client.connect(transport); clients.set(server.serverId, client); return client
  }
  return {
    async call(call) {
      const started = Date.now(), server = byId.get(call.serverId)
      if (!server) return { status: 404, ok: false, detail: "MCP server not found", durationMs: Date.now() - started }
      try {
        const result = await (await clientFor(server)).callTool({ name: call.tool, arguments: call.args as Record<string, unknown> | undefined })
        return { status: result.isError ? 502 : 200, ok: result.isError !== true, detail: text(result), durationMs: Date.now() - started }
      } catch (error) { return { status: 502, ok: false, detail: error instanceof Error ? error.message : "MCP upstream failed", durationMs: Date.now() - started } }
    },
    async close() { for (const client of clients.values()) await client.close(); clients.clear() },
  }
}
