/**
 * channels/dws/parse.ts - NORMALIZING dws list payloads.
 *
 * Concept: dws records are schema-unstable (ids/text/nesting vary by
 * version), so keys are probed defensively. toIncoming drops our own
 * messages and non-text records; parseDwsList unwraps either a bare array
 * or a messages/result payload into a flat list.
 */
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

/** normalize one raw dws message record; null when not a text message we handle */
export const toIncoming = (record: Record<string, unknown>, source: DwsSource, meUserId?: string): IncomingMessage | undefined => {
  const id = firstOf(record, ["msgId", "messageId", "id", "msg_id"])
  if (id === "") return undefined
  // text may be nested (text.content / content / richText...) or an array of blocks
  const text =
    firstOf(record, ["textContent", "text", "content"]) ||
    (typeof record.text === "object" && record.text !== null
      ? asString((record.text as Record<string, unknown>).content ?? (record.text as Record<string, unknown>).text)
      : "")
  const senderId = firstOf(record, ["senderId", "senderStaffId", "sender", "userId", "senderId_str"])
  const senderNick = firstOf(record, ["senderNick", "senderName", "nick"])
  if (meUserId !== undefined && senderId !== "" && senderId === meUserId) return undefined // own message
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

/** parse a dws chat message list json payload into incoming messages */
export const parseDwsList = (json: string, source: DwsSource, meUserId?: string): ReadonlyArray<IncomingMessage> => {
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
