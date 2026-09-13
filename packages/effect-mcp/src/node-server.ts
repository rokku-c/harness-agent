import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import { registerTools, type ToolSurface } from "./node-server/tools.js"
import { registerResources, type NodeResourcePlanes, type NodeStorePlane } from "./node-server/resources.js"
export type { NodeResourcePlanes, NodeStorePlane }
export type { ToolChange, ToolSurface } from "./node-server/tools.js"
export { emptyToolChange, toolChangeIsEmpty } from "./node-server/tools.js"

/**
 * A node MCP server that can re-reconcile its tool list when the underlying
 * registry changes (app hot-swap, kernel reload). The intersection keeps every
 * existing `McpServer` usage valid.
 */
export type NodeMcpServer = McpServer & { readonly toolSurface: ToolSurface }

export const buildNodeMcpServer = (registry: EffectRegistry, planes?: NodeResourcePlanes): NodeMcpServer => {
  const server = new McpServer({ name: "effect-node", version: "0.1.0" })
  const toolSurface = registerTools(server, registry)
  if (planes) registerResources(server, planes)
  return Object.assign(server, { toolSurface })
}
