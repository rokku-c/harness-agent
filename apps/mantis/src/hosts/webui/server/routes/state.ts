/**
 * server/routes/state.ts - STATE + EVENTS HTTP routes.
 *
 * Concept: liveness (health for pm2/docker/LB), the whole-console snapshot
 * and the SSE event poll - each a read over the MCP server. The event poll
 * is stateless: every request advances its own cursor, so nothing replays.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json, parseJsonLines } from "../helpers.ts"

export const routeState = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  const path = url.pathname
  if (request.method !== "GET") return undefined
  if (path === "/api/health") {
    const text = await callText(client, "mantis_state")
    const state = JSON.parse(text) as { startedAt?: number; approvalsOn?: boolean }
    return json({ ok: true, startedAt: state.startedAt ?? Date.now(), approvalsOn: state.approvalsOn === true })
  }
  if (path === "/api/state") return json(JSON.parse(await callText(client, "mantis_state")) as unknown)
  if (path === "/api/events") {
    const afterParam = url.searchParams.get("after")
    const after = afterParam === null ? 0 : Number(afterParam)
    const events = parseJsonLines<{ ts: number }>(
      await callText(client, "mantis_events", { after: Number.isFinite(after) && after >= 0 ? after : 0 })
    )
    return json({ events })
  }
  return undefined
}
