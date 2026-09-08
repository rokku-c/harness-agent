import { identityFromHeaders } from "./identity.ts"
import type { McpGateway } from "./gateway.ts"

export const makeGatewayHandler = (gateway: McpGateway) => async (request: Request): Promise<Response> => {
  if (new URL(request.url).pathname !== "/mcp-gateway/call" || request.method !== "POST") return Response.json({ ok: false, error: "Not found" }, { status: 404 })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }) }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false, error: "Invalid call" }, { status: 400 })
  const raw = body as Record<string, unknown>, identity = identityFromHeaders(request.headers)
  if (typeof raw.tool !== "string" || raw.tool.length === 0) return Response.json({ ok: false, error: "tool is required" }, { status: 400 })
  const result = await gateway.handle({ ...identity, callId: identity.requestId ?? crypto.randomUUID(), tool: raw.tool,
    setId: typeof raw.setId === "string" ? raw.setId : undefined, serverId: typeof raw.serverId === "string" ? raw.serverId : undefined,
    args: raw.args && typeof raw.args === "object" && !Array.isArray(raw.args) ? raw.args as Record<string, unknown> : undefined })
  return Response.json(result, { status: result.status })
}
