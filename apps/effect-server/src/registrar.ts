/**
 * mcp-registrar — register plugins over MCP transports, like MCP servers.
 *
 * A plugin can be reached in-process (EffectPlugin), as a stdio child, or as
 * a remote streamable-http server. For stdio/http we connect with the MCP
 * client, discover the server's tools (with their JSON-Schema inputSchema),
 * and register them as an EffectInterface whose handlers proxy back over the
 * transport. Returns a disposer that unregisters + closes on disable.
 */

import type { EffectApp, EffectInterface, EffectRegistry, EffectTool } from "@effect-agent/effect-interface"
import { connectPlugin } from "./registrar/connect.ts"

export interface McpPluginEntry {
  /** registry interface id, e.g. "apps/time-server". */
  readonly id: string
  readonly transport: "stdio" | "http"
  /** stdio: spawn command (use process.execPath to run a bun server). */
  readonly command?: string
  readonly args?: readonly string[]
  /** http: remote streamable-http endpoint. */
  readonly url?: string
  readonly headers?: Readonly<Record<string, string>>
}

type Disposer = () => Promise<void>

const textOf = (content: unknown): string => {
  if (!Array.isArray(content)) return ""
  return content
    .filter((c): c is { type: "text"; text?: string } => typeof c === "object" && c !== null && (c as { type?: string }).type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
}

export const registerMcpPlugin = async (
  registry: EffectRegistry,
  entry: McpPluginEntry,
): Promise<Disposer> => {
  const client = await connectPlugin(entry)

  const listed = await client.listTools()
  const tools: EffectTool[] = listed.tools.map((tool) => ({
    name: tool.name,
    title: tool.title ?? tool.name,
    description: tool.description ?? tool.name,
    inputSchema: tool.inputSchema as unknown,
    handler: async (args: unknown) => {
      const result = await client.callTool({ name: tool.name, arguments: args as Record<string, unknown> })
      return { ok: result.isError !== true, text: textOf(result.content) }
    },
  }))

  // discover the server's UI app resources too (ui://), like MCP Apps
  const apps: EffectApp[] = []
  try {
    const resources = await (
      client.listResources as () => Promise<{ resources?: Array<{ uri: string; name?: string; description?: string }> }>
    )()
    for (const resource of resources.resources ?? []) {
      if (resource.uri.startsWith("ui://")) {
        apps.push({
          id: resource.uri,
          title: resource.name ?? resource.uri,
          description: resource.description,
          resourceUri: resource.uri,
        })
      }
    }
  } catch {
    /* server does not expose resources — tools-only plugin */
  }

  const iface: EffectInterface = {
    id: entry.id,
    title: entry.id,
    description: `mcp plugin via ${entry.transport}`,
    tools,
    apps,
  }
  const dispose = registry.registerInterface(iface)

  let closed = false
  return async () => {
    if (closed) return
    closed = true
    dispose()
    try {
      await client.close()
    } catch {
      /* already closed */
    }
  }
}
