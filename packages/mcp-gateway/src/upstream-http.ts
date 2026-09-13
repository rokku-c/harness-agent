import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpGatewayServer, McpUpstream } from "./contract.ts"
import { makeUpstream } from "./upstream-call.ts"

/** Structural match for the SDK's FetchLike, which is not exported from streamableHttp.js. */
export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>
export interface McpHttpServer extends McpGatewayServer {
  readonly transport: "streamable-http" | "stdio"
  readonly endpoint: string
  readonly headers?: Readonly<Record<string, string>>
}
export interface McpHttpUpstreamOptions { readonly servers: readonly McpHttpServer[]; readonly fetch?: FetchLike }

/** Every request uses the platform-supplied fetch, so egress policy stays in
 *  one place rather than being re-decided inside the transport. */
export const makeStreamableHttpUpstream = (options: McpHttpUpstreamOptions): McpUpstream & { close(): Promise<void> } =>
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
