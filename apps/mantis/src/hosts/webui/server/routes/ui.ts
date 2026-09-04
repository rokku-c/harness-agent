/**
 * server/routes/ui.ts - the AGENT-UI HTTP routes.
 *
 * Concept: read the latest/versioned agent-rendered A2UI surfaces or roll
 * back to a previous version (recorded as a new version) - mirrors the MCP
 * ui tools for the browser panel.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json, parseJsonLines } from "../helpers.ts"

export const routeUi = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  const path = url.pathname
  if (request.method === "GET" && path === "/api/ui/latest") {
    const text = await callText(client, "mantis_ui_latest")
    return text === "(empty)"
      ? json({ empty: true })
      : json({ messages: JSON.parse(text) as unknown })
  }
  if (request.method === "GET" && path === "/api/ui/versions") {
    const versions = parseJsonLines<Record<string, unknown>>(await callText(client, "mantis_ui_versions"))
    return json({ versions })
  }
  if (request.method === "POST" && path === "/api/ui/restore") {
    const body = (await request.json()) as { version?: number }
    if (typeof body.version !== "number") return json({ ok: false, detail: "version required" }, 400)
    const text = await callText(client, "mantis_ui_restore", { version: body.version })
    return text === "restored" ? json({ ok: true }) : json({ ok: false, detail: text })
  }
  return undefined
}
