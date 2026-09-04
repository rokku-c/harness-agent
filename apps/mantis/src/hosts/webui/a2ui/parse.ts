/**
 * a2ui/parse.ts - BATCH PARSING for ui_render specs.
 *
 * Concept: accept the two wire forms (JSONL lines or a JSON array), validate
 * each message structurally, sanitize every updateComponents component
 * against the official catalog, require a createSurface (surfaceId +
 * catalogId) in every batch, then normalize the surface root. The panel
 * renders the result with the OFFICIAL renderers; this module never renders.
 */
import { isMessage, type A2uiMessage } from "./types.ts"
import { sanitizeComponent } from "./sanitize.ts"
import { ensureSurfaceRoot } from "./root.ts"

export interface ParseResult {
  readonly messages: A2uiMessage[]
  readonly error?: string
}

export const parseA2uiBatch = (spec: string): ParseResult => {
  const trimmed = spec.trim()
  if (trimmed === "") return { messages: [], error: "empty spec" }
  let parsed: unknown
  if (trimmed.startsWith("[")) {
    try {
      parsed = JSON.parse(trimmed) as unknown
    } catch {
      return { messages: [], error: "spec is not valid JSON" }
    }
  } else {
    // JSONL: every non-empty line is one message
    const messages: unknown[] = []
    for (const line of trimmed.split("\n")) {
      const text = line.trim()
      if (text === "") continue
      try {
        messages.push(JSON.parse(text) as unknown)
      } catch {
        return { messages: [], error: "spec line is not valid JSON: " + text.slice(0, 60) }
      }
    }
    parsed = messages
  }
  if (!Array.isArray(parsed)) return { messages: [], error: "spec must be a JSON array of A2UI messages (or JSONL)" }
  if (parsed.length === 0) return { messages: [], error: "empty message batch" }
  const messages: A2uiMessage[] = []
  for (const item of parsed) {
    if (!isMessage(item)) return { messages: [], error: "not an A2UI v0.9 message: " + JSON.stringify(item).slice(0, 120) }
    const message = item as A2uiMessage
    if ("updateComponents" in message) {
      const update = message.updateComponents
      messages.push({
        version: message.version,
        updateComponents: {
          surfaceId: update.surfaceId,
          components: update.components.map((component) => sanitizeComponent(component as Record<string, unknown>))
        }
      } as A2uiMessage)
      continue
    }
    messages.push(message)
  }
  if (!messages.some((message) => "createSurface" in message))
    return { messages: [], error: "a batch needs a createSurface message (surfaceId + catalogId)" }
  return { messages: ensureSurfaceRoot(messages) }
}
