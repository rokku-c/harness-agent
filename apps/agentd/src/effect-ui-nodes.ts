/**
 * The shapes every block of the agentd console is built from: what the framework
 * states for every console, re-exported, and the one the machine center has an
 * opinion of its own about — the table its single source is read through, whose
 * emptiness is the framework's `emptyRows` because four lists share one verdict.
 *
 * A list here is drawn only while it has a first row, from the same condition its
 * notice reads: four lists under one source read `ready` while any one of them
 * has a row, so a bare `table` under that notice is a header row over no rows —
 * the table saying there are columns of nothing under the sentence saying there
 * is nothing. `whenRows` on `stateRows(list)` is that condition, and it is the
 * one the notice is the complement of.
 *
 * What differs between sections — which columns, which fields — lives with the
 * section it belongs to; the cells themselves live in `effect-ui-cells.ts`.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyRows, failureNotice, loadingRows, table as tableOf } from "@effect-agent/effect-ui"

export { field, heading, section, text } from "@effect-agent/effect-ui"

/** The one source this page reads: machines, agents, and the registry they use. */
export const STATUS_SOURCE = "status"

/**
 * A table over one source's list, named rather than composed: this page reads
 * one source, so its tables say which list they read and which field holds it.
 * The framework's table owns the shape.
 */
export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], source: string, key?: string): UiNodeSpec =>
  tableOf(headings, cells, { source: { state: source }, ...(key === undefined ? {} : { key }) })

/**
 * Loading, empty, and failed, in that order, directly above the list they
 * describe. Each list stands in for itself with two placeholder bars rather
 * than three: four lists of three placeholders is a page of nothing else before
 * the first answer.
 */
export const listStates = (list: string, empty: string): readonly UiNodeSpec[] =>
  [loadingRows(STATUS_SOURCE, 2), emptyRows(STATUS_SOURCE, list, empty), failureNotice(STATUS_SOURCE)]
