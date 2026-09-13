/**
 * What every MCP upstream owes, written once.
 *
 * A transport's `call` is a contract, not an implementation detail: the server
 * the caller named is either known (404 when it is not), answers (200, or 502
 * with the text it sent when it reports `isError`), or throws (502 with the
 * message). Two transports wrote that mapping out separately and the copies had
 * already drifted, in the string nobody reads until a call fails. What is left
 * here is the shared half; a transport supplies only how one server is wired.
 *
 * The same client answers both questions a server can be asked — what it
 * advertises, and one call — because they are the same conversation. Two
 * clients per server would be two processes for a stdio server and two views of
 * one tool list, which is exactly how a door comes to advertise something it
 * cannot carry.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { CatalogTool, McpToolLister } from "./catalog.ts"
import type { McpUpstream } from "./contract.ts"
import type { McpGatewayServer } from "./contract-sets.ts"

/** The readable text of a tool result: its text blocks, one per line. */
const text = (result: { content?: readonly unknown[] }): string =>
  (result.content ?? []).map((item) => {
    const value = item as { type?: string; text?: string }
    return value.type === "text" ? value.text ?? "" : ""
  }).join("\n")

export interface UpstreamOptions<S extends McpGatewayServer> {
  readonly servers: readonly S[]
  /** Wire one server's transport onto its own client. At most once per server. */
  readonly connect: (server: S, client: Client) => Promise<void>
}

export type McpUpstreamServer = McpUpstream & McpToolLister & { close(): Promise<void> }

/** A lazy client per server: nothing is started until a call or a listing names it. */
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
