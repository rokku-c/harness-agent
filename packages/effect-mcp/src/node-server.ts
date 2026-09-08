import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import { registerTools } from "./node-server/tools.js"
import { registerResources, type NodeResourcePlanes, type NodeStorePlane } from "./node-server/resources.js"
export type { NodeResourcePlanes, NodeStorePlane }
export const buildNodeMcpServer = (registry: EffectRegistry, planes?: NodeResourcePlanes): McpServer => {
  const server = new McpServer({ name: "effect-node", version: "0.1.0" })
  registerTools(server, registry)
  if (planes) registerResources(server, planes)
  return server
}
