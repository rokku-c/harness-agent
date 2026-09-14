import type { IncomingMessage } from "../../messages.ts"

export const robotMessageText = (message: Record<string, unknown>): string => {
  const flatten = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join("\n").trim()
    if (typeof value !== "object" || value === null) return ""
    const record = value as Record<string, unknown>
    return [record.content, record.text, record.title, record.richText].map(flatten).filter(Boolean).join("\n").trim()
  }
  return flatten(message.text ?? message.content ?? message.markdown)
}

export const toIncomingRobot = (raw: Record<string, unknown>): IncomingMessage | undefined => {
  const id = typeof raw.msgId === "string" ? raw.msgId : ""
  const conversationId = typeof raw.conversationId === "string" ? raw.conversationId : ""
  if (id === "" || conversationId === "") return undefined
  const text = robotMessageText(raw)
  const senderId = typeof raw.senderStaffId === "string" ? raw.senderStaffId : "unknown"
  const senderNick = typeof raw.senderNick === "string" ? raw.senderNick : undefined
  return {
    id,
    text,
    conversationId,
    conversationType: String(raw.conversationType ?? "2") === "1" ? "single" : "group",
    senderId,
    senderNick,
    addressed: String(raw.conversationType ?? "2") === "1" || raw.isInAtList === true,
    ts: Date.now()
  }
}
