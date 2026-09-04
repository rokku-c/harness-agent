/**
 * server/routes/message.ts - CHAT routes.
 *
 * Concept: post a user message (fire-and-forget; the reply streams back over
 * /api/events) or forward an A2UI button action as an [ui.action] message.
 * Both accept an optional conversationId and answer accepted/rejected.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json } from "../helpers.ts"

const accepted = (text: string): Response =>
  text.startsWith("accepted")
    ? json({ accepted: true })
    : json({ accepted: false, detail: text.startsWith("error: ") ? text.slice(7) : text })

export const routeMessage = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  const path = url.pathname
  if (request.method !== "POST") return undefined
  if (path === "/api/message") {
    const body = (await request.json()) as { conversationId?: string; text?: string }
    if (body.text === undefined || body.text.trim() === "")
      return json({ accepted: false, detail: "empty message" })
    // fire-and-forget: the reply streams back over /api/events
    const text = await callText(client, "mantis_chat", {
      conversationId: body.conversationId ?? "ui",
      text: body.text,
      wait: false
    })
    return accepted(text)
  }
  if (path === "/api/ui/action") {
    const body = (await request.json()) as { conversationId?: string; action?: string; values?: Record<string, string> }
    if (body.action === undefined) return json({ ok: false, detail: "action required" }, 400)
    const values = body.values ?? {}
    const payload = Object.keys(values).length === 0
      ? "[ui.action] " + body.action
      : "[ui.action] " + body.action + " " + JSON.stringify(values)
    const text = await callText(client, "mantis_chat", {
      conversationId: body.conversationId ?? "ui",
      text: payload,
      wait: false
    })
    return accepted(text)
  }
  return undefined
}
