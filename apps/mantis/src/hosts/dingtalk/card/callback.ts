/**
 * card/callback.ts - PARSING the TOPIC_CARD callback.
 *
 * Concept: the DingTalk card callback is a nested, schema-unstable payload
 * (button params may sit at several depths, values may be JSON strings).
 * parseCardAction walks the whole tree with defensive helpers - findString
 * for outTrackId, findAction/collect scanning every string token for the
 * static approve/deny tokens - and returns the verdict or undefined when no
 * actionable button click is present.
 */
import { callIdFromOutTrackId, type CardAction } from "./types.ts"

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** first string value under the key anywhere in the tree */
const findString = (node: unknown, key: string): string | undefined => {
  if (typeof node === "string") return node === key ? node : undefined
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findString(item, key)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (typeof node !== "object" || node === null) return undefined
  const record = node as Record<string, unknown>
  for (const [k, value] of Object.entries(record)) {
    if (k === key) {
      if (typeof value === "string") return value
      const nested = typeof value === "object" && value !== null
        ? findString(value, key)
        : undefined
      if (nested !== undefined) return nested
    } else {
      const found = findString(value, key)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** scan every string value for an approve/deny token (buttons, params, ...) */
const findAction = (node: unknown): CardAction["action"] | undefined => {
  const tokens = collect(node)
  if (tokens.includes("approve") || tokens.includes("同意")) return "approve"
  if (tokens.includes("deny") || tokens.includes("拒绝")) return "deny"
  return undefined
}

/** every distinct string token in the tree (JSON strings and values) */
const collect = (node: unknown): string[] => {
  if (typeof node === "string") {
    const parsed = safeParse(node)
    return parsed === undefined ? [node.trim().toLowerCase()] : collect(parsed)
  }
  if (Array.isArray(node)) return node.flatMap(collect)
  if (typeof node !== "object" || node === null) return []
  return Object.values(node as Record<string, unknown>).flatMap(collect)
}

/** parse a TOPIC_CARD callback payload into an approval verdict */
export const parseCardAction = (data: unknown): CardAction | undefined => {
  const root = typeof data === "string" ? safeParse(data) : data
  if (typeof root !== "object" || root === null) return undefined
  const record = root as Record<string, unknown>
  const action = findAction(record)
  if (action === undefined) return undefined
  const outTrackId = findString(record, "outTrackId")
  if (outTrackId === undefined) return undefined
  const callId = callIdFromOutTrackId(outTrackId)
  if (callId === "") return undefined
  return { callId, action }
}
