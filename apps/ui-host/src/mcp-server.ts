/**
 * The standalone stdio host: the same declarations, as an MCP server.
 *
 * `main.ts` is a UI runtime an agent drives rather than a browser, so it serves
 * no routes at all and takes the one projection of the operations it can use.
 * Registering a tool from the same `Operation` is what keeps this host and the
 * embedded one from drifting into two different canvases.
 *
 * The SDK takes a zod shape rather than the operation's own object schema, so
 * the shape is read from that one schema instead of being restated here.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { uiOperations } from "./ops/index.ts"
import type { UiSurfaces } from "./ops/surfaces.ts"

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) ?? "null" }] })

export const makeUiMcpServer = (surfaces: UiSurfaces): McpServer => {
  const server = new McpServer({ name: "ui-runtime", version: "0.1.0" })
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: { description: string; inputSchema: unknown },
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) => void
  for (const op of uiOperations(surfaces)) {
    register(op.name, { description: op.description, inputSchema: op.input.shape },
      async (args) => text(await op.handler(args as never, {})))
  }
  return server
}
