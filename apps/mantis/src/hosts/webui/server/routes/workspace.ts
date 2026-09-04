/**
 * server/routes/workspace.ts - the DECLARATIVE WORKSPACE HTTP routes.
 *
 * Concept: the panel reads the whole workspace (derived from the resource
 * declarations) and writes records directly (no agent turn, no approval) -
 * the same MCP tools an agent client would use, over HTTP. Errors carry the
 * readable detail from the tool answer.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json } from "../helpers.ts"

export const routeWorkspace = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  if (url.pathname !== "/api/workspace") return undefined
  if (request.method === "GET") {
    const text = await callText(client, "mantis_workspace")
    return json(JSON.parse(text) as unknown)
  }
  if (request.method === "POST") {
    const body = (await request.json()) as { kind?: string; text?: string }
    if (body.kind === undefined || body.text === undefined || body.text.trim() === "")
      return json({ ok: false, detail: "kind and text required" }, 400)
    const text = await callText(client, "mantis_workspace_write", { kind: body.kind, text: body.text })
    if (text.startsWith("error:")) return json({ ok: false, detail: text.slice(7) })
    return json({ ok: true, record: JSON.parse(text) as unknown })
  }
  if (request.method === "PATCH") {
    const body = (await request.json()) as { recordId?: string; text?: string }
    if (body.recordId === undefined || body.text === undefined || body.text.trim() === "")
      return json({ ok: false, detail: "recordId and text required" }, 400)
    const text = await callText(client, "mantis_workspace_update", { id: body.recordId, text: body.text })
    if (text.startsWith("error:")) return json({ ok: false, detail: text.slice(7) })
    return json({ ok: true, record: JSON.parse(text) as unknown })
  }
  if (request.method === "DELETE") {
    const recordId = url.searchParams.get("recordId")
    if (recordId === null) return json({ ok: false, detail: "recordId required" }, 400)
    const text = await callText(client, "mantis_workspace_delete", { id: recordId })
    if (text.startsWith("error:")) return json({ ok: false, detail: text.slice(7) })
    return json({ ok: true, detail: text })
  }
  return undefined
}
