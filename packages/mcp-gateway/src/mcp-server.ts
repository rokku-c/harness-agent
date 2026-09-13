import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, type CallToolResult, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js"
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv"
import type { McpGateway } from "./gateway.ts"
import { identityFromRequest } from "./identity.ts"
import { type McpToolSurface, resolveSurfacePrincipal, surfaceTarget, surfaceTools } from "./mcp-surface.ts"

const callSchema = { type: "object", properties: {
  setId: { type: "string", minLength: 1 }, serverId: { type: "string", minLength: 1 },
  tool: { type: "string", minLength: 1 }, args: { type: "object" },
}, required: ["tool"], additionalProperties: false } as const
const validator = new AjvJsonSchemaValidator().getValidator<CallInput>(callSchema)
type CallInput = { readonly setId?: string; readonly serverId?: string; readonly tool: string; readonly args?: Record<string, unknown> }
const tool = { name: "mcp_gateway_call", description: "Call an authorized MCP gateway tool.", inputSchema: callSchema }
const textResult = (value: unknown, isError: boolean): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value) }], isError })

/**
 * Builds the gateway's MCP surface.
 *
 * With a `surface`, the gateway advertises the proxied tool catalog and answers
 * each caller with its own projection; the caller supplies the same `authz` to
 * `makeMcpGateway`, which is what actually enforces the calls. Without one it
 * advertises the single multiplexed `mcp_gateway_call` — the pre-convergence
 * shape, kept only until the app switches over.
 */
export const buildMcpGatewayServer = (gateway: McpGateway, surface?: McpToolSurface): Server => {
  const server = new Server({ name: "effect-agent-mcp-gateway", version: "0.0.0" }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => {
    if (surface === undefined) return { tools: [tool] }
    const call = { headers: extra.requestInfo?.headers, authInfo: extra.authInfo }
    return { tools: surfaceTools(surface, resolveSurfacePrincipal(surface, call)) as ListToolsResult["tools"] }
  })
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const identity = identityFromRequest({ authInfo: extra.authInfo, headers: extra.requestInfo?.headers })
    const callId = identity.requestId ?? String(extra.requestId ?? crypto.randomUUID())
    if (surface !== undefined) {
      const entry = surfaceTarget(surface, request.params.name)
      if (entry === undefined) throw new McpError(ErrorCode.InvalidParams, "Unknown gateway tool")
      const principal = resolveSurfacePrincipal(surface, { headers: extra.requestInfo?.headers, authInfo: extra.authInfo }).principal
      const result = await gateway.handle({ ...identity, ...(principal === undefined ? {} : { principal }), callId, serverId: entry.serverId, tool: entry.tool, args: request.params.arguments })
      return textResult(result, !result.ok)
    }
    if (request.params.name !== tool.name) throw new McpError(ErrorCode.InvalidParams, "Unknown gateway tool")
    const parsed = validator(request.params.arguments ?? {})
    if (!parsed.valid) throw new McpError(ErrorCode.InvalidParams, parsed.errorMessage)
    if (!identity.agent) return textResult({ ok: false, status: 401, decision: "deny", detail: "missing_identity" }, true)
    const result = await gateway.handle({ ...identity, callId, ...parsed.data })
    return textResult(result, !result.ok)
  })
  return server
}
