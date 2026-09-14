import { sourceConversationId, type DwsSource } from "./source.ts"
import type { IncomingMessage } from "../../messages.ts"

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "")
const firstOf = (record: Record<string, unknown>, keys: ReadonlyArray<string>): string => {
  for (const key of keys) {
    const value = asString(record[key])
    if (value !== "") return value
  }
  return ""
}

export const toIncoming = (record: Record<string, unknown>, source: DwsSource, meUserId: string): IncomingMessage | undefined => {
  const id = firstOf(record, ["msgId", "messageId", "id", "msg_id"])
  if (id === "") return undefined
  const text =
    firstOf(record, ["textContent", "text", "content"]) ||
    (typeof record.text === "object" && record.text !== null
      ? asString((record.text as Record<string, unknown>).content ?? (record.text as Record<string, unknown>).text)
      : "")
  const senderId = firstOf(record, ["senderId", "senderStaffId", "sender", "userId", "senderId_str"])
  const senderNick = firstOf(record, ["senderNick", "senderName", "nick"])
  if (senderId !== "" && senderId === meUserId) return undefined
  return {
    id,
    text,
    conversationId: sourceConversationId(source),
    conversationType: source.kind === "group" ? "group" : "single",
    senderId: senderId === "" ? "unknown" : senderId,
    senderNick: senderNick === "" ? undefined : senderNick,
    addressed:
      source.kind === "direct" ||
      record.isInAtList === true ||
      record.atMe === true ||
      firstOf(record, ["isInAtList", "atMe"]).toLowerCase() === "true",
    ts: Number(firstOf(record, ["createTime", "createdAt", "timestamp"]) || 0) || Date.now()
  }
}

export const parseDwsList = (json: string, source: DwsSource, meUserId: string): ReadonlyArray<IncomingMessage> => {
  let payload: unknown
  try {
    payload = JSON.parse(json)
  } catch {
    return []
  }
  const records = Array.isArray(payload)
    ? payload
    : (payload as Record<string, unknown>).messages ?? (payload as Record<string, unknown>).result ?? []
  return (Array.isArray(records) ? records : [])
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((record) => toIncoming(record, source, meUserId))
    .filter((message): message is IncomingMessage => message !== undefined)
}
