/**
 * console/helpers.ts - SHARED VALUE HELPERS.
 *
 * Concept: short() trims a value for the observability stream (full payloads
 * stay in the log); when text is cut, the marker states how much was dropped
 * so consumers can tell loss happened instead of silently seeing "...".
 */
/** trim a value for the observability stream (full payloads stay in the log) */
export const short = (value: unknown, max = 160): string => {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value)
    return text.length > max ? text.slice(0, max) + "… (+truncated " + (text.length - max) + " chars)" : text
  } catch {
    return "(unserializable)"
  }
}
