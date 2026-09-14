import type { OutgoingTarget, Reply } from "../../messages.ts"
import { DINGTALK_API, robotAccessToken } from "../openapi.ts"

export const postWebhookReply = async (webhook: string, reply: Reply): Promise<void> => {
  if (webhook === "") return
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "text", text: { content: reply.text } })
  })
}

export type TextSender = (target: OutgoingTarget, text: string) => Promise<void>

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
