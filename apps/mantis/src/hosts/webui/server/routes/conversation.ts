import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { callText, json } from "../helpers.ts"

export const routeConversation = async (url: URL, request: Request, client: Client): Promise<Response | undefined> => {
  if (request.method !== "GET" || url.pathname !== "/api/conversation") return undefined
  const conversationId = url.searchParams.get("conversationId")
  if (conversationId === null) return json({ error: "conversationId required" }, 400)
  const text = await callText(client, "mantis_conversation", { conversationId })
  const entries = text === "(empty)"
    ? []
    : text.split("\n").map((line) => JSON.parse(line) as unknown)
  return json({ conversationId, entries })
}
