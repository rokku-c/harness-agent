/**
 * channels/robot/send.ts - OUTBOUND replies + openapi sends.
 *
 * Concept: two ways a robot speaks. Reactive replies POST text to the
 * message's sessionWebhook (no access-token dance); proactive sends go
 * through the robot openapi (oToMessages for a direct chat, groupMessages
 * for a group) with a token fetched and cached like the original clawyp.
 */
import type { OutgoingTarget, Reply } from "../../messages.ts"
import { DINGTALK_API, robotAccessToken } from "../openapi.ts"

/** reactive reply: POST to the message's sessionWebhook (no token dance) */
export const postWebhookReply = async (webhook: string, reply: Reply): Promise<void> => {
  if (webhook === "") return
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "text", text: { content: reply.text } })
  })
}

export type TextSender = (target: OutgoingTarget, text: string) => Promise<void>

/** proactive text send via the robot openapi (markdown card, like clawyp) */
export const openApiTextSender = (clientId: string, clientSecret: string): TextSender => {
  const sendOpenApi = async (target: OutgoingTarget, text: string): Promise<void> => {
    const token = await robotAccessToken(clientId, clientSecret)
    const headers = {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": token
    }
    const body = {
      robotCode: clientId,
      msgKey: "sampleMarkdown",
      msgParam: JSON.stringify({ title: "mantis", text })
    }
    const endpoint =
      target.kind === "direct"
        ? DINGTALK_API + "/v1.0/robot/oToMessages/batchSend"
        : DINGTALK_API + "/v1.0/robot/groupMessages/send"
    const payload = target.kind === "direct"
      ? { ...body, userIds: [target.userId] }
      : { ...body, openConversationId: target.conversationId }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string }
      throw new Error("dingtalk robot send failed: " + (data.message ?? response.status))
    }
  }
  return sendOpenApi
}
