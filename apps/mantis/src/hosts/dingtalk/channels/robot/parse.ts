/**
 * channels/robot/parse.ts - NORMALIZING raw stream payloads.
 *
 * Concept: dingtalk robot messages arrive in several content shapes (text/
 * content/markdown/richText trees). robotMessageText flattens them into one
 * trimmed string (mirroring the original clawyp extraction); toIncomingRobot
 * turns a raw stream message into our IncomingMessage, dropping non-addressable
 * ones (empty ids, no @ in group).
 */
import type { IncomingMessage } from "../../messages.ts"

/** flatten a robot message payload into text (mirrors the original clawyp extraction) */
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

/** normalize a raw stream robot message into our IncomingMessage */
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
    // a robot only receives messages that address it (single chat or @ in group)
    addressed: String(raw.conversationType ?? "2") === "1" || raw.isInAtList === true,
    ts: Date.now()
  }
}
