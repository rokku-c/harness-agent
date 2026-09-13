/**
 * The shapes every block of the agentd console is built from: what the framework
 * states for every console, re-exported, and the one the machine center has an
 * opinion of its own about — the table its single source is read through.
 *
 * A list here is drawn only while it has a first row, from the same condition its
 * notice reads: four lists under one source read `ready` while any one of them
 * has a row, so a bare `table` under that notice is a header row over no rows —
 * the table saying there are columns of nothing under the sentence saying there
 * is nothing. `whenRows` on `stateRows(list)` is that condition, and the notice
 * each list stands in for itself with is the framework's `emptyRows`, which is
 * that same condition's complement.
 *
 * Whether the read is still running or failed is not a fact about a list, so it
 * is not stated here: it belongs to the screen the read feeds, once, above every
 * list on it (`empty-rows.ts`).
 *
 * What differs between sections — which columns, which fields — lives with the
 * section it belongs to; the cells themselves live in `effect-ui-cells.ts`.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { table as tableOf } from "@effect-agent/effect-ui"

export { field, heading, section, text } from "@effect-agent/effect-ui"

/** The one source the fleet is read from: machines, agents, and the registry they use. */
export const STATUS_SOURCE = "status"

/**
 * A table over one source's list, named rather than composed: the fleet is one
 * read, so its tables say which list they read and which field holds it. The
 * framework's table owns the shape.
 */
export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], source: string, key?: string): UiNodeSpec =>
  tableOf(headings, cells, { source: { state: source }, ...(key === undefined ? {} : { key }) })
