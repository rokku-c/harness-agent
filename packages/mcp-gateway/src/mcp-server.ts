import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js"

import { identityFromRequest } from "./identity.ts"
import { type McpToolSurface, resolveSurfacePrincipal, surfaceTarget, surfaceTools } from "./mcp-surface.ts"

const textResult = (value: unknown, isError: boolean) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }], isError })

export const buildMcpGatewayServer = (surface: McpToolSurface): Server => {
  const server = new Server({ name: "effect-agent-mcp-gateway", version: "0.0.0" }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => {
    const call = { headers: extra.requestInfo?.headers, authInfo: extra.authInfo }
    await surface.refresh?.()
    return { tools: [...await surfaceTools(surface, resolveSurfacePrincipal(surface, call))] }
  })
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const identity = identityFromRequest({ authInfo: extra.authInfo, headers: extra.requestInfo?.headers })
    const callId = identity.requestId ?? String(extra.requestId ?? crypto.randomUUID())
    const resolved = resolveSurfacePrincipal(surface, { headers: extra.requestInfo?.headers, authInfo: extra.authInfo })
    if (resolved.principal === undefined) {
      return textResult({ ok: false, status: 401, decision: "deny", detail: resolved.detail ?? "no_principal" }, true)
    }
    const entry = surfaceTarget(surface, request.params.name)
    if (entry === undefined) throw new McpError(ErrorCode.InvalidParams, "Unknown gateway tool")
    const result = await surface.gateway.handle({
      ...identity, callId, principal: resolved.principal, serverId: entry.serverId, tool: entry.tool,
      args: request.params.arguments,
    })
    return textResult(result, !result.ok)
  })
  return server
}
