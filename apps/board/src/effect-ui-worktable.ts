/**
 * The worktable: one row per work item, in tree order.
 *
 * This is the board's primary surface, and its shape comes from what an operator
 * does with a board — dispatch work, watch for blockers, watch for failures —
 * rather than from columns of cards. Everything those three questions need is on
 * the row, so none of them needs a click, and the state is read off the field
 * the filter reads so a filtered row cannot be a row the badges contradict.
 *
 * `id` is read and not drawn: it is the repeat key and the value a row's press
 * carries, and a UUID in a column is noise beside a title a person already reads.
 */

import { cellOf, press, row, stateBadge, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { matchesFilter } from "./effect-ui-filter.ts"
import { taskSignals } from "./effect-ui-signals.ts"

/** The union of what both shapes read, so switching a shape never refetches. */
const shown = ["id", "title", "state", "body", "agent", "waits", "failure", "parentTitle"]
export const worktableUrl = `/board/api/table?columns=${shown.join(",")}`

/** A column heading, at the row's own density: one line, no cell is taller than the rows under it. */
const heading = (value: string): UiNodeSpec =>
  ({ component: "Table.ColumnHeaderCell", props: { value, py: "2", px: "2" } })

/** The title a person reads, over what the title does not say. */
const workItem: UiNodeSpec = cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [{ component: "Text", props: { size: "2", weight: "medium", item: "title" } }, taskSignals],
})

/** State is an enumeration, so its badge is the colourless one: colour is for signals. */
const stateCell: UiNodeSpec = cellOf(row([stateBadge("state")]))

/**
 * Who holds the task, and the case where nobody does. The second is said out
 * loud rather than left blank, because a blank cell cannot be told apart from a
 * read that has not landed yet.
 */
const heldBy: UiNodeSpec = cellOf(row([
  { component: "Code", props: { size: "1" }, item: "agent", visible: { source: { item: "agent" } } },
  { component: "Text", props: { value: "Nobody", size: "1", color: "gray" },
    visible: { source: { item: "agent" }, not: true } },
]))

const workRow: UiNodeSpec = {
  component: "Table.Row",
  children: [
    workItem,
    stateCell,
    heldBy,
    // The one press a row carries: opening a task is a decision about one task,
    // and the record itself is the business of the screen this enters.
    cellOf(row([press("Open", "board.open", { taskId: { item: "id" } }, { size: "1", variant: "soft" })])),
  ],
}

/**
 * The table is drawn only while the read carried a row: a header over no rows is
 * a table of columns of nothing, and the sentence that stands in for it is the
 * read's own verdict that it carried none. The two read different fields of one
 * verdict, so neither can call a board empty that the other has rows for.
 *
 * The one case the two cannot settle between them is a filter that matches none
 * of the rows the board does have: the table is drawn, because the board has
 * rows, and the body under it draws none, because none survived the filter. The
 * layer cannot count matched rows and so can never tell the table it is empty.
 * The sentence above it carries that fact instead, and the `All` chip beside it
 * is the way back.
 */
export const worktable: UiNodeSpec = whenRows(stateRows("/table/rows"), {
  component: "Table.Root",
  props: { variant: "surface", size: "1" },
  children: [
    { component: "Table.Header", children: [{ component: "Table.Row", children: [
      heading("Work item"), heading("State"), heading("Held by"), heading(""),
    ] }] },
    { component: "Table.Body",
      repeat: { source: { state: "/table/rows" }, key: "id" },
      visible: matchesFilter,
      children: [workRow] },
  ],
})
