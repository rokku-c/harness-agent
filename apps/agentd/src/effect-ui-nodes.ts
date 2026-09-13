/**
 * The shapes every block of the agentd console is built from: what the framework
 * states for every console, re-exported, and the three the machine center has an
 * opinion of its own about — the table its single source is read through, the
 * emptiness of a list that shares that source, and the three states above it.
 * A line of chips comes from the framework's `row`, which owns that remedy too.
 *
 * What differs between sections — which columns, which fields — lives with the
 * section it belongs to; the cells themselves live in `effect-ui-cells.ts`.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, sourceStatusPath, table as tableOf } from "@effect-agent/effect-ui"

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
 * A list with no first row, said out loud — but only once the source answered.
 * Four lists share one source, so its verdict cannot say "empty" for any one of
 * them: it stays ready while any of them has a row, and a verdict of ready over
 * an empty table is a bare header. Such a list asks its own first row instead.
 */
export const emptyList = (list: string, message: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column" },
  visible: { source: { state: `${sourceStatusPath(STATUS_SOURCE)}/answered` }, equals: true },
  children: [{ component: "Text", props: { value: message, color: "gray", size: "2" },
    visible: { source: { state: `${list}/0` }, not: true } }],
})

/**
 * Loading, empty, and failed, in that order, directly above the list they
 * describe. Each list stands in for itself with two placeholder bars rather
 * than three: four lists of three placeholders is a page of nothing else before
 * the first answer.
 */
export const listStates = (list: string, empty: string): readonly UiNodeSpec[] =>
  [loadingRows(STATUS_SOURCE, 2), emptyList(list, empty), failureNotice(STATUS_SOURCE)]
