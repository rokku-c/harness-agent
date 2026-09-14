import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpGatewayServer } from "./contract-sets.ts"
import { makeUpstream, type McpUpstreamServer } from "./upstream-call.ts"

export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>
export interface McpHttpServer extends McpGatewayServer {
  readonly transport: "streamable-http" | "stdio"
  readonly endpoint: string
  readonly headers?: Readonly<Record<string, string>>
}
export interface McpHttpUpstreamOptions { readonly servers: readonly McpHttpServer[]; readonly fetch?: FetchLike }

export const makeStreamableHttpUpstream = (options: McpHttpUpstreamOptions): McpUpstreamServer =>
  makeUpstream({
    servers: options.servers,
    connect: async (server, client) => {
      if (server.transport !== "streamable-http") throw new Error(`MCP server ${server.serverId} is not streamable-http`)
      await client.connect(new StreamableHTTPClientTransport(new URL(server.endpoint), {
        fetch: options.fetch,
        requestInit: { headers: server.headers as Record<string, string> | undefined }
      }))
    }
  })
