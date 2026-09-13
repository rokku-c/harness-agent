/**
 * Reading a value out of a projection's data, and writing it back as text.
 *
 * Two projections — the plain one and the tokenized one — both address data by
 * the same JSON-pointer path and both print what they find. Written twice, they
 * drifted: one guarded the empty path and the other did not, and one printed
 * `undefined` as the empty string while the other returned the value
 * `undefined` from a function declared to return `string`. One copy removes the
 * chance of a third difference.
 */

/** The value at a JSON-pointer path, or `undefined` where there is none. */
export const valueAt = (root: unknown, path?: string): unknown => {
  if (path === undefined || path === "") return undefined
  let cur: unknown = root
  for (const seg of path.replace(/^\//, "").split("/")) {
    if (cur === null || typeof cur !== "object" || !(seg in (cur as Record<string, unknown>))) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/** A value as text. Always a string: absence prints as nothing, and a value
 * that cannot be serialized — a cycle — falls back to its own `String`. */
export const show = (value: unknown): string => {
  if (value === undefined) return ""
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
