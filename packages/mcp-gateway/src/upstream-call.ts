import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { CatalogTool, McpToolLister } from "./catalog.ts"
import type { McpUpstream } from "./contract.ts"
import type { McpGatewayServer } from "./contract-sets.ts"

const text = (result: { content?: readonly unknown[] }): string =>
  (result.content ?? []).map((item) => {
    const value = item as { type?: string; text?: string }
    return value.type === "text" ? value.text ?? "" : ""
  }).join("\n")

export interface UpstreamOptions<S extends McpGatewayServer> {
  readonly servers: readonly S[]
  readonly connect: (server: S, client: Client) => Promise<void>
}

export type McpUpstreamServer = McpUpstream & McpToolLister & { close(): Promise<void> }

export const makeUpstream = <S extends McpGatewayServer>(options: UpstreamOptions<S>): McpUpstreamServer => {
  const byId = new Map(options.servers.map((server) => [server.serverId, server]))
  const clients = new Map<string, Client>()
  const clientFor = async (server: S): Promise<Client> => {
    const existing = clients.get(server.serverId)
    if (existing !== undefined) return existing
    const client = new Client({ name: "effect-agent-mcp-gateway", version: "1.0.0" })
    await options.connect(server, client)
    clients.set(server.serverId, client)
    return client
  }
  return {
    async list(server) {
      const known = byId.get(server.serverId) ?? (server as S)
      const result = await (await clientFor(known)).listTools()
      return (result.tools ?? []).map((tool): CatalogTool => ({
        name: tool.name,
        ...(tool.description === undefined ? {} : { description: tool.description }),
        ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
      }))
    },
    async call(call) {
      const started = Date.now(), server = byId.get(call.serverId)
      if (server === undefined) return { status: 404, ok: false, detail: "MCP server not found", durationMs: Date.now() - started }
      try {
        const result = await (await clientFor(server)).callTool({ name: call.tool, arguments: call.args as Record<string, unknown> | undefined })
        return {
          status: result.isError === true ? 502 : 200,
          ok: result.isError !== true,
          detail: text(result as unknown as { content?: readonly unknown[] }),
          durationMs: Date.now() - started
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "MCP upstream failed"
        return { status: 502, ok: false, detail, durationMs: Date.now() - started }
      }
    },
    async close() { for (const client of clients.values()) await client.close(); clients.clear() }
  }
}
