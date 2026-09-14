/**
 * The board as columns: the same tasks, read as a wall instead of a list.
 *
 * Kept as the second shape of the one screen rather than as a second screen. A
 * row is what a dispatcher watches, but the one question a list answers badly is
 * how the work is spread, and five columns answer it in a glance. Both shapes
 * read the same rows and draw the same signals, so a task that is blocked reads
 * as blocked in either.
 *
 * An entry is deliberately not a card. A card is admitted where a block has its
 * own identity and its own controls, and the design system lists the places that
 * is true; a task in a column is not one of them, and a card that wraps every
 * entry is a box drawn five times to say what a gap already says. What separates
 * two entries here is space, and what says where one ends is the title's own
 * weight against the body text under it.
 *
 * Every column is drawn whether or not it has tasks. A state that has gone quiet
 * is a fact about the board, and a column that disappeared when it emptied would
 * take that fact with it.
 */

import { press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { taskSignals } from "./effect-ui-signals.ts"
import { stateOptions, type StateOption } from "./effect-ui-states.ts"

/** One task: what it is called, what it says, what it is waiting on, and the one thing to do with it. */
const entry: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      { component: "Text", props: { size: "2", weight: "medium", item: "title" } },
      // drawn only when the task has one: an empty paragraph is a gap, not a fact
      { component: "Text", props: { size: "1", color: "gray", item: "body", visible: { source: { item: "body" } } } },
      taskSignals,
    ] },
    // the press is the entry's own, so it sits in a row: laid straight into the
    // entry's column it would span the column and read as a bar under the title
    // rather than as the one thing this task can do
    row([press("Open", "board.open", { taskId: { item: "id" } }, { size: "1", variant: "soft" })]),
  ],
}

/**
 * One state's column. `repeat` belongs to the stack rather than to the entry,
 * because it repeats the element's *children* once per item: on the entry it
 * would repeat the entry's lines and pile every task into one block.
 */
const column = (option: StateOption): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "4" },
  children: [
    { component: "Heading", props: { size: "3", value: option.label } },
    { component: "Flex",
      props: { direction: "column", gap: "3" },
      repeat: { source: { state: "/table/rows" }, key: "id" },
      visible: { source: { item: "state" }, equals: option.value },
      children: [entry] },
  ],
})

export const boardColumns: UiNodeSpec = {
  component: "Grid",
  props: { columns: { initial: "1", sm: "2", md: "3", xl: "5" }, gap: "3", align: "start" },
  children: stateOptions.map((option) => column(option)),
}
