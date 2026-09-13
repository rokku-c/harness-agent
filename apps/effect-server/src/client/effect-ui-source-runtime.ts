import type { StateStore } from "@json-render/core"
import type { UiSourceSpec } from "@effect-agent/effect-ui"
import { readStatus, sourceStateOf, sourceStatusPath } from "@effect-agent/effect-ui/source-status"

/**
 * Entries a list-shaped answer carries: its own, when the body is an array, or
 * the entries of its array-valued fields. This is what "the list is empty" is
 * decided from, so it counts rows rather than keys.
 */
const rowsIn = (body: unknown): number => {
  if (Array.isArray(body)) return body.length
  if (typeof body !== "object" || body === null) return 0
  return Object.values(body).reduce<number>((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)
}

const readError = (body: unknown, status: number): string => {
  if (typeof body === "object" && body !== null) {
    const detail = (body as { detail?: unknown; error?: unknown }).detail ?? (body as { error?: unknown }).error
    if (typeof detail === "string") return detail
  }
  return `HTTP ${status}`
}

/**
 * One read of one source.
 *
 * The two writes are deliberately separate. The body goes to the source's own
 * path and only when the read succeeded, so a failure leaves the rows that are
 * already on screen exactly where they are. The verdict goes to the source's
 * status path either way, so a surface can say "this could not be read" without
 * having to tell that apart from "there is nothing here".
 */
export const loadSource = async (source: UiSourceSpec, store: StateStore, fetcher: typeof fetch): Promise<void> => {
  const statusPath = sourceStatusPath(source.id), previous = readStatus(store.get(statusPath))
  // a source that has answered keeps its verdict while a refresh is in flight:
  // re-entering the loading state would flash placeholders over live rows
  if (!previous.answered) store.set(statusPath, { ...previous, state: "loading" })
  try {
    const response = await fetcher(source.url, { cache: "no-store", headers: { accept: "application/json" } })
    const body: unknown = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    if (!response.ok) throw new Error(readError(body, response.status))
    store.set(source.state, body)
    const count = rowsIn(body)
    store.set(statusPath, { state: sourceStateOf(true, null, count), answered: true, error: null, count, at: Date.now() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.set(statusPath, { ...previous, state: "failed", error: message, at: Date.now() })
  }
}
