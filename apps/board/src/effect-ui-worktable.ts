import { cellOf, press, row, stateBadge, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { matchesFilter, matchesQuery } from "./effect-ui-filter.ts"
import { taskSignals } from "./effect-ui-signals.ts"

const shown = ["id", "title", "state", "body", "agent", "waits", "failure", "parentTitle"]
export const worktableUrl = `/board/api/table?columns=${shown.join(",")}`

const heading = (value: string): UiNodeSpec =>
  ({ component: "Table.ColumnHeaderCell", props: { value, py: "2", px: "2" } })

const workItem: UiNodeSpec = cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [{ component: "Text", props: { size: "2", weight: "medium" }, item: "title" }, taskSignals],
})

const stateCell: UiNodeSpec = cellOf(row([stateBadge("state")]))

const heldBy: UiNodeSpec = cellOf(row([
  { component: "Code", props: { size: "1" }, item: "agent", visible: { source: { item: "agent" } } },
  { component: "Text", props: { value: "Nobody", size: "1", color: "gray" },
    visible: { source: { item: "agent" }, not: true } },
]))

const workRow: UiNodeSpec = {
  component: "Table.Row",
  visible: matchesQuery,
  children: [
    workItem,
    stateCell,
    heldBy,
    cellOf(row([press("Open", "board.open", { taskId: { item: "id" } }, { size: "1", variant: "soft" })])),
  ],
}
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
