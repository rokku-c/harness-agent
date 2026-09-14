export const valueAt = (root: unknown, path?: string): unknown => {
  if (path === undefined || path === "") return undefined
  let cur: unknown = root
  for (const seg of path.replace(/^\//, "").split("/")) {
    if (cur === null || typeof cur !== "object" || !(seg in (cur as Record<string, unknown>))) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

export const show = (value: unknown): string => {
  if (value === undefined) return ""
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
