/**
 * Serve the registered effect-interfaces as a real MCP server.
 *
 * Every tool in the effect-interface registry is exposed to MCP clients (name
 * "interfaceId.tool", JSON-Schema-derived input), so anything that speaks MCP
 * — Claude, our own stdio/http registrar, tooling — can list and call the
 * whole registered surface through one protocol.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import { invoke } from "@effect-agent/effect-interface"
import { zodShapeFromJsonSchema } from "./schema-zod.ts"

/** build an SDK MCP server exposing every registered tool. */
export const buildRegistryMcpServer = (registry: EffectRegistry): McpServer => {
  const server = new McpServer({ name: "effect-agent", version: "0.1.0" })
  // narrowed typing: SDK registerTool generics explode on our zod-shape type
  const register = server.registerTool.bind(server) as (
    name: string,
    config: { title?: string; description?: string; inputSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>,
  ) => void
  for (const entry of registry.tools()) {
    const { tool } = entry
    const mcpName = entry.key.replace(/[^A-Za-z0-9_-]+/g, "_")
    const params = tool.inputSchema as { type?: string; properties?: Record<string, unknown>; required?: string[] } | undefined
    register(
      mcpName,
      {
        title: tool.title ?? tool.name,
        description: tool.description ?? tool.name,
        inputSchema: zodShapeFromJsonSchema(params),
      },
      async (args: Record<string, unknown>) => {
        try {
          const out = await invoke(tool, args ?? {})
          return { content: [{ type: "text", text: JSON.stringify(out) }] }
        } catch (error) {
          return {
            content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
            isError: true,
          }
        }
      },
    )
  }
  return server
}

/** serve the registry to one MCP client over stdio (run as a subprocess). */
export const runRegistryMcpServerStdio = async (registry: EffectRegistry): Promise<McpServer> => {
  const server = buildRegistryMcpServer(registry)
  await server.connect(new StdioServerTransport())
  return server
}

if (import.meta.main) {
  const { makeEffectRegistry } = await import("@effect-agent/effect-interface")
  const { bootManifests } = await import("./load-manifest.ts")
  const { makePluginHost } = await import("@effect-agent/effect-host")

  const host = makePluginHost()
  const registry = makeEffectRegistry()
  await bootManifests(
    { host, registry },
    (process.env.EFFECT_MANIFEST_ROOTS ?? "apps,packages").split(",").map((s) => s.trim()).filter(Boolean),
  )
  await runRegistryMcpServerStdio(registry)
}
