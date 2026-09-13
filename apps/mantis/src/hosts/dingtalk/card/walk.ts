/**
 * card/walk.ts - WALKING the callback payload.
 *
 * Concept: the DingTalk card callback is a nested, schema-unstable payload -
 * button params sit at several depths and values arrive as JSON strings. These
 * helpers are the generic reading of it, with no opinion about approvals:
 * safeParse, unwrapJson (decode JSON strings in place), findString (a value by
 * field name), actionsOf (every value under a field named `action`). What a
 * verdict then IS belongs to callback.ts.
 */

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** a payload node with every JSON-string value replaced by what it encodes */
export const unwrapJson = (node: unknown): unknown => {
  if (typeof node === "string") {
    const parsed = safeParse(node)
    return parsed === undefined ? node : unwrapJson(parsed)
  }
  if (Array.isArray(node)) return node.map(unwrapJson)
  if (typeof node !== "object" || node === null) return node
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>).map(([k, value]) => [k, unwrapJson(value)])
  )
}

/** first string value under the key anywhere in the tree */
export const findString = (node: unknown, key: string): string | undefined => {
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

/** every value sitting under a field named `action`, anywhere in the payload */
export const actionsOf = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(actionsOf)
  if (typeof node !== "object" || node === null) return []
  const record = node as Record<string, unknown>
  const here = typeof record.action === "string" ? [record.action] : []
  return [...here, ...Object.values(record).flatMap(actionsOf)]
}
