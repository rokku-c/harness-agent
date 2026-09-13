/**
 * The board as columns: the same tasks, read as a wall instead of a list.
 *
 * Kept as the optional view rather than the default. A card cannot say who
 * holds a node, what it waits for, or why it stopped without being opened,
 * which is what a dispatcher is looking at — but the one thing a list answers
 * badly is how the work is spread, and five columns answer that in a glance.
 *
 * Cards are grouped by the state the task is *in*, the same field the worktable
 * filters on, so a task sits in exactly one column whichever view is on screen.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row } from "@effect-agent/effect-ui"

export const stateOptions = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
]

const card: UiNodeSpec = {
  component: "Card",
  props: { size: "1", variant: "surface" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "2" }, children: [
      { component: "Flex", props: { direction: "column", gap: "1" }, children: [
        { component: "Text", props: { weight: "medium" }, item: "title" },
        // shown only when the task has one: an empty paragraph is a gap, not a fact
        { component: "Text", props: { size: "1", color: "gray" }, item: "body", visible: { source: { item: "body" } } },
      ] },
      // the press is the card's own, so it sits in a row: laid straight into the
      // card's column it would span the card and read as a bar under the title
      // rather than as the one thing this card can do
      row([{ component: "Button", props: { value: "Open", size: "1", variant: "soft" },
        onPress: "board.open", params: { taskId: { item: "id" } } }]),
    ] },
  ],
}

/**
 * A column. `repeat` belongs to the list, not to the card: it repeats the
 * element's *children* once per item, so the container stays single and only
 * the cards multiply — which is also what makes an empty column empty rather
 * than one blank card.
 */
const column = (state: string, label: string): UiNodeSpec => ({
  component: "Card",
  children: [
    { component: "Heading", props: { size: "3", value: label } },
    { component: "Separator", props: { size: "4" } },
    {
      component: "Flex",
      props: { direction: "column", gap: "2" },
      repeat: { source: { state: "/table/rows" }, key: "id" },
      visible: { source: { item: "state" }, equals: state },
      children: [card],
    },
  ],
})

export const boardColumns: UiNodeSpec = {
  component: "Grid",
  props: { columns: { initial: "1", sm: "2", lg: "3" }, gap: "3", align: "start" },
  children: stateOptions.map((option) => column(option.value, option.label)),
}
