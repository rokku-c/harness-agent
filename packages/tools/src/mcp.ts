/**
 * MCP adapter seam (E8 ToolTransport). The real transports (stdio /
 * streamable-http) belong to an implementation package; here we define the
 * session surface and a bridge from any McpSession into ToolDescriptors,
 * plus an in-memory fake server for tests. Same descriptors, any transport.
 */
import { Context, Effect } from "effect"
import type { ToolDescriptor } from "./descriptor.ts"

export interface McpToolInfo {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

export interface McpSession {
  readonly name: string
  readonly listTools: () => Promise<ReadonlyArray<McpToolInfo>>
  readonly callTool: (name: string, input: unknown) => Promise<unknown>
}

export type McpClientConfig =
  | { readonly _tag: "stdio"; readonly command: string; readonly args: ReadonlyArray<string> }
  | { readonly _tag: "http"; readonly url: string; readonly headers?: Readonly<Record<string, string>> }

export interface McpClientService {
  readonly connect: (config: McpClientConfig) => Effect.Effect<McpSession, unknown>
}

export class McpClient extends Context.Tag("effect-agent/McpClient")<McpClient, McpClientService>() {}

export const mcpSessionToDescriptors = (
  session: McpSession,
  access: "read" | "write" = "write",
  execute?: (name: string, input: unknown) => Promise<unknown>
): Promise<ReadonlyArray<ToolDescriptor>> =>
  session.listTools().then((tools) =>
    tools.map((info) => ({
      name: info.name,
      description: info.description,
      inputSchema: info.inputSchema,
      access,
      execute: (input: unknown) =>
        execute ? execute(info.name, input) : session.callTool(info.name, input)
    }))
  )

/** In-memory fake MCP server: serves descriptors as its tool surface. */
export const MemoryMcpServer = (name: string, tools: ReadonlyArray<ToolDescriptor>): McpSession => ({
  name,
  listTools: async () =>
    tools.map((descriptor) => ({
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema
    })),
  callTool: async (name, input) => {
    const descriptor = tools.find((candidate) => candidate.name === name)
    if (descriptor === undefined) throw new Error("mcp: unknown tool " + name)
    return descriptor.execute(input)
  }
})
