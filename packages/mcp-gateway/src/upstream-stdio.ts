import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { McpGatewayServer } from "./contract-sets.ts"
import { makeUpstream, type McpUpstreamServer } from "./upstream-call.ts"

export interface McpStdioUpstreamOptions { readonly servers: readonly McpGatewayServer[] }

/** Each server gets its own client process. The environment is inherited: a
 *  stdio server is a local command and expects the PATH, HOME and credentials
 *  the gateway was started with, with `server.env` layered over them. */
export const makeStdioUpstream = (options: McpStdioUpstreamOptions): McpUpstreamServer =>
  makeUpstream({
    servers: options.servers,
    connect: async (server, client) => {
      if (server.command === undefined) throw new Error(`MCP server ${server.serverId} has no stdio command`)
      const inherited = Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
      await client.connect(new StdioClientTransport({
        command: server.command,
        args: [...server.args ?? []],
        env: { ...inherited, ...server.env }
      }))
    }
  })
