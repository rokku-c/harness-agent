/**
 * server/routes/approvals.ts - the APPROVAL HTTP route.
 *
 * Concept: the operator resolves one pending approval from the panel - the
 * same mantis_approve an MCP agent client would call.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json } from "../helpers.ts"

export const routeApprovals = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  if (request.method !== "POST" || url.pathname !== "/api/approval/resolve") return undefined
  const body = (await request.json()) as { callId?: string; allow?: boolean }
  if (body.callId === undefined) return json({ ok: false, detail: "callId required" }, 400)
  const text = await callText(client, "mantis_approve", { callId: body.callId, allow: body.allow === true })
  return text === "resolved" ? json({ ok: true }) : json({ ok: false, detail: text })
}
