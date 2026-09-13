/**
 * What a list shows before its source answers, when the source answered with
 * nothing, and when it failed.
 *
 * The host runtime keeps one small record per declared source, at
 * `/_sources/<id>` — a root the language reserves, so no view declares it. Two
 * things follow from keeping it there rather than in the source's own subtree.
 * A failed fetch no longer overwrites the rows already on screen, and the three
 * states every list has are named once here instead of re-invented per app, so
 * an app cannot present a failure as an empty list or an empty list as a
 * failure.
 *
 * A view switches on the record's one word with the language's own `visible`
 * equality — `{ source: { state: "/_sources/<id>/state" }, equals: "empty" }` —
 * or uses the three notices below, which are that comparison written out.
 */
import type { UiNodeSpec } from "./spec.ts"

export type SourceState = "loading" | "ready" | "empty" | "failed"

/** The runtime's record for one source. Read it; the runtime is what writes it. */
export interface SourceStatus {
  /** The one word a view switches on. */
  readonly state: SourceState
  /**
   * Whether any answer has ever landed. Until one has the source reads as
   * loading, and it never reads as loading again: a refresh that re-entered the
   * state would flash a placeholder over rows the reader is looking at.
   */
  readonly answered: boolean
  /** What the last failed attempt said, kept until an attempt succeeds. */
  readonly error: string | null
  /** Entries the last good answer carried — what "empty" is decided from. */
  readonly count: number
  readonly at: number
}

export const sourceStatusPath = (id: string): string => `/_sources/${id}`

/** A source that has not been read yet: loading, with nothing to fall back on. */
export const initialStatus = (): SourceStatus =>
  ({ state: "loading", answered: false, error: null, count: 0, at: 0 })

/**
 * The verdict, in one place and in one order: a failure outranks everything —
 * an empty list and a list that could not be read are not the same thing.
 */
export const sourceStateOf = (answered: boolean, error: string | null, count: number): SourceState =>
  error !== null ? "failed" : !answered ? "loading" : count === 0 ? "empty" : "ready"

/** Rows a list-shaped answer carries; `at` is when the last answer landed. */
export const readStatus = (value: unknown): SourceStatus => {
  const record = (value ?? {}) as Partial<SourceStatus>
  return { ...initialStatus(), ...record }
}

const when = (id: string, state: SourceState): UiNodeSpec["visible"] =>
  ({ source: { state: `${sourceStatusPath(id)}/state` }, equals: state })

/** Placeholder bars, sized like the rows they stand in for. */
export const loadingRows = (id: string, rows = 3): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: when(id, "loading"),
  children: Array.from({ length: rows }, () => ({ component: "Skeleton", props: { height: "1.75rem" } })),
})

/** The source answered and has nothing in it. Said out loud, rather than blank. */
export const emptyNotice = (id: string, message: string): UiNodeSpec => ({
  component: "Text",
  props: { value: message, color: "gray", size: "2" },
  visible: when(id, "empty"),
})

/**
 * The source could not be read, naming what it said. Any rows already on screen
 * are still on screen — this sits above them, not in place of them.
 */
export const failureNotice = (id: string): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", size: "1" },
  visible: when(id, "failed"),
  children: [{ component: "Callout.Text", bind: `${sourceStatusPath(id)}/error` }],
})

/** All three, in the order a list wants them. */
export const sourceStates = (id: string, empty: string, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyNotice(id, empty), failureNotice(id)]
