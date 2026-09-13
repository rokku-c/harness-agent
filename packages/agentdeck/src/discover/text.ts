/**
 * Text helpers for reading agent transcripts. Transcripts interleave things a
 * human wrote with things the agent framework injected, so every "what did the
 * person actually say" question goes through `looksMachine` first.
 */

export const record = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>

export const text = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** first line of a multi-line body, clipped - list views want one line */
export const headline = (value: string, max = 160): string => {
  const line = value.split("\n").map((part) => part.trim()).find((part) => part.length > 0) ?? ""
  return line.length > max ? line.slice(0, max) : line
}

/** a line with no letters or digits at all: a rule, a fence, padding */
const separator = /^[^\p{L}\p{N}]+$/u

/**
 * An agent transcript's early user turns are usually injected instruction text
 * (AGENTS.md, system reminders, permission blocks) or transcript furniture, not
 * something a human wrote. None of it may become the title of a session.
 */
export const looksMachine = (value: string): boolean => {
  const line = value.trimStart()
  return line.startsWith("<") ||
    line.startsWith("#") ||
    line.startsWith("Caveat:") ||
    line.startsWith("```") ||
    separator.test(line)
}

/** the first record carrying `key` as a non-empty string */
export const firstField = (records: ReadonlyArray<unknown>, key: string): string | undefined => {
  for (const raw of records) {
    const value = text(record(raw)[key])
    if (value !== undefined) return value
  }
  return undefined
}

export const millis = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}
