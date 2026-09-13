/**
 * The board's header: what the screen is, which shape of it is on, and the two
 * doors out of it.
 *
 * The worktable and the columns are one screen's two shapes and are never both
 * on screen, so the switch between them belongs beside the title rather than
 * inside either shape — and the shape itself says when it is drawn
 * (`effect-ui.ts`). The doors are here, above the scrolling region, because the
 * board below them has no limit and they must not scroll away with it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

const heading = (value: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Heading", props: { value, ...props } })

const item = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value }, children: [{ component: "Text", props: { value: label } }] })

const viewSwitch: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/view",
  children: [item("table", "Worktable"), item("board", "Columns")],
}

/** The two doors out of the board, and the reason they are here rather than in the list below. */
const doors: UiNodeSpec = {
  component: "Flex",
  props: { align: "center", gap: "3", wrap: "wrap" },
  children: [viewSwitch, { component: "Button", props: { value: "New task", variant: "solid" }, onPress: "board.new" }],
}

export const boardHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Board", { size: "6" }),
      { component: "Text", props: { value: "Hierarchical work items, who holds each one, and what is blocking them.", color: "gray" } },
    ] },
    doors,
  ],
}
