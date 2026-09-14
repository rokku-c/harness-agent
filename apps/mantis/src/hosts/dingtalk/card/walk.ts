const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

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

export const actionsOf = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(actionsOf)
  if (typeof node !== "object" || node === null) return []
  const record = node as Record<string, unknown>
  const here = typeof record.action === "string" ? [record.action] : []
  return [...here, ...Object.values(record).flatMap(actionsOf)]
}
