/**
 * The board's own line: what the surface is, which shape of it is on, and the
 * door to a new task.
 *
 * The shape switch belongs here rather than inside either shape. The worktable
 * and the columns are two readings of one read and are never both on screen, so
 * a switch living in one of them would vanish with it and leave the operator no
 * way back to the other.
 *
 * The header is outside the region below it, and that is the point: the board has
 * no limit, and a control that scrolled away with the rows would have to be
 * fetched back by hand.
 *
 * The heading is a section title (size 4), not a display one: the one display
 * heading in this console belongs to Home, and a screen inside an app is a
 * section of the product rather than a page of it.
 */

import { heading, press, type UiNodeSpec } from "@effect-agent/effect-ui"

/** One chip per shape. Its label is a child, because `value` is the item's own value. */
const item = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value }, children: [{ component: "Text", props: { value: label } }] })

const viewSwitch: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/view",
  children: [item("table", "Worktable"), item("board", "Columns")],
}

export const boardHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "center", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Board", { size: "4" }),
      { component: "Text",
        props: { value: "Hierarchical work items, who holds each one, and what is blocking them.",
          size: "2", color: "gray" } },
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" },
      children: [viewSwitch, press("New task", "board.new", undefined, { variant: "solid" })] },
  ],
}
