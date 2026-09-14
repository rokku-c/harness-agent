/**
 * server/routes/message.ts - CHAT routes.
 *
 * Concept: post a user message and answer whether it was taken. Two ways to be
 * answered, and the caller says which it can use. Fired (`wait: false`, what a
 * streaming client wants) the reply arrives later as a "reply" event, so
 * the answer is only the acceptance. Waited out, the answer is the turn's own
 * outcome — for a caller with no event stream to catch the reply on, waiting is
 * how the reply reaches it at all.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json } from "../helpers.ts"

/** A fired turn: "accepted", or the refusal the tool answered with. */
const accepted = (text: string): Response =>
  text.startsWith("accepted")
    ? json({ accepted: true })
    : json({ accepted: false, detail: text.startsWith("error: ") ? text.slice(7) : text })

/** A turn that was waited out: everything but an error is the turn having run. */
const turned = (text: string): Response =>
  text.startsWith("error: ")
    ? json({ accepted: false, detail: text.slice(7) })
    : json({ accepted: true, reply: text })

export const routeMessage = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  const path = url.pathname
  if (request.method !== "POST") return undefined
  if (path === "/api/message") {
    const body = (await request.json()) as { conversationId?: string; text?: string; wait?: boolean }
    if (body.text === undefined || body.text.trim() === "")
      return json({ accepted: false, detail: "empty message" })
    const conversationId = body.conversationId ?? "ui"
    if (body.wait === true) return turned(await callText(client, "mantis_chat", { conversationId, text: body.text, wait: true }))
    return accepted(await callText(client, "mantis_chat", { conversationId, text: body.text, wait: false }))
  }
  return undefined
}
