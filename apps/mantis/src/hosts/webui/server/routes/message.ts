import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json } from "../helpers.ts"

const accepted = (text: string): Response =>
  text.startsWith("accepted")
    ? json({ accepted: true })
    : json({ accepted: false, detail: text.startsWith("error: ") ? text.slice(7) : text })

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
