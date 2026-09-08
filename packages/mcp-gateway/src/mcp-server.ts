import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, type CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv"
import type { McpGateway } from "./gateway.ts"
import { identityFromRequest } from "./identity.ts"

const callSchema = { type: "object", properties: {
  setId: { type: "string", minLength: 1 }, serverId: { type: "string", minLength: 1 },
  tool: { type: "string", minLength: 1 }, args: { type: "object" },
}, required: ["tool"], additionalProperties: false } as const
const validator = new AjvJsonSchemaValidator().getValidator<CallInput>(callSchema)
type CallInput = { readonly setId?: string; readonly serverId?: string; readonly tool: string; readonly args?: Record<string, unknown> }
const tool = { name: "mcp_gateway_call", description: "Call an authorized MCP gateway tool.", inputSchema: callSchema }
const textResult = (value: unknown, isError: boolean): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value) }], isError })

export const buildMcpGatewayServer = (gateway: McpGateway): Server => {
  const server = new Server({ name: "effect-agent-mcp-gateway", version: "0.0.0" }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [tool] }))
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const parsed = validator(request.params.arguments ?? {})
    if (!parsed.valid) throw new McpError(ErrorCode.InvalidParams, parsed.errorMessage)
    const identity = identityFromRequest({ authInfo: extra.authInfo, headers: extra.requestInfo?.headers })
    if (!identity.agent) return textResult({ ok: false, status: 401, decision: "deny", detail: "missing_identity" }, true)
    const result = await gateway.handle({ ...identity, callId: identity.requestId ?? String(extra.requestId ?? crypto.randomUUID()), ...parsed.data })
    return textResult(result, !result.ok)
  })
  return server
}
