/**
 * The worktable: one row per work item, in tree order.
 *
 * This is board's primary surface, and its shape comes from what an operator
 * does with a board — dispatch work, watch for blockers, watch for failures —
 * rather than from columns of cards. So everything those three questions need
 * is on the row: the state it is in, who holds it, and, on a second line under
 * the title, what it waits for and why it stopped. None of it needs a click. A
 * board you open row by row is a list of titles, not a board.
 *
 * `id` is fetched and not shown: it is the repeat key, and a UUID is noise.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { stateOptions } from "./effect-ui-board.ts"

/** The union of what both views read, so switching views does not refetch. */
const shown = ["id", "title", "state", "body", "agent", "waits", "failure", "parentTitle"]
export const worktableUrl = `/board/api/table?columns=${shown.join(",")}`

const text = (value: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Text", props: { value, ...props } })

/**
 * A labelled signal on the row's second line, shown only when it has something
 * to say — the guard is the value itself, so an absent parent, an empty waits
 * list, and a task that never stopped all take no space.
 */
const signal = (label: string, field: string, color: string): UiNodeSpec => ({
  component: "Flex",
  props: { gap: "1", align: "baseline" },
  visible: { source: { item: field } },
  children: [text(label, { size: "1", color: "gray" }), { component: "Text", props: { size: "1", color }, item: field }],
})

const workItem: UiNodeSpec = {
  component: "Table.Cell",
  children: [{
    component: "Flex",
    props: { direction: "column", gap: "1" },
    children: [
      { component: "Text", props: { weight: "medium" }, item: "title" },
      { component: "Flex", props: { gap: "3", wrap: "wrap" }, children: [
        signal("in", "parentTitle", "gray"),
        signal("waits on", "waits", "amber"),
        signal("stopped:", "failure", "red"),
      ] },
    ],
  }],
}

/** The one action a row carries: changing a state is a decision about one task. */
const openButton: UiNodeSpec = {
  component: "Button",
  props: { value: "Open", size: "1", variant: "soft" },
  onPress: "board.open",
  params: { taskId: { item: "id" } },
}

const row: UiNodeSpec = {
  component: "Table.Row",
  children: [
    workItem,
    { component: "Table.Cell", children: [{ component: "Badge", props: { variant: "soft" }, item: "state" }] },
    { component: "Table.Cell", children: [{ component: "Text", props: { size: "2", color: "gray" }, item: "agent" }] },
    { component: "Table.Cell", children: [openButton] },
  ],
}

/** The chips read the same field the rows do, so they cannot disagree with them. */
const chip = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value }, children: [text(label)] })

export const stateFilter: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/filter",
  children: [chip("all", "All"), ...stateOptions.map((option) => chip(option.value, option.label))],
}

/** "All" is not an equality against the row, so the filter is the two as alternatives. */
const matchesFilter: UiNodeSpec["visible"] = {
  any: [
    { source: { state: "/filter" }, equals: "all" },
    { source: { item: "state" }, equals: { state: "/filter" } },
  ],
}

export const worktable: UiNodeSpec = {
  component: "Table.Root",
  props: { variant: "surface" },
  children: [
    { component: "Table.Header", children: [{ component: "Table.Row", children: [
      { component: "Table.ColumnHeaderCell", props: { value: "Work item" } },
      { component: "Table.ColumnHeaderCell", props: { value: "State" } },
      { component: "Table.ColumnHeaderCell", props: { value: "Held by" } },
      { component: "Table.ColumnHeaderCell", props: { value: "" } },
    ] }] },
    { component: "Table.Body", repeat: { source: { state: "/table/rows" }, key: "id" }, visible: matchesFilter, children: [row] },
  ],
}
