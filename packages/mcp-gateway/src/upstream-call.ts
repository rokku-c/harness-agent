/**
 * What every MCP upstream owes, written once.
 *
 * A transport's `call` is a contract, not an implementation detail: the server
 * the caller named is either known (404 when it is not), answers (200, or 502
 * with the text it sent when it reports `isError`), or throws (502 with the
 * message). Two transports wrote that mapping out separately and the copies had
 * already drifted, in the string nobody reads until a call fails. What is left
 * here is the shared half; a transport supplies only how one server is wired.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { McpGatewayServer, McpUpstream } from "./contract.ts"

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

/** A lazy client per server: nothing is started until a call names it. */
export const makeUpstream = <S extends McpGatewayServer>(
  options: UpstreamOptions<S>
): McpUpstream & { close(): Promise<void> } => {
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
