import type { UiNodeSpec } from "@effect-agent/effect-ui"

export {
  cellOf, emptyMessage, emptyRows, failureCallout, failureNotice, field, heading, itemRows,
  loadingRows, press, region, row, section, sourceStates, stateBadge, stateRows, table, text, whenRows,
} from "@effect-agent/effect-ui"

export const rowValue = (item: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", ...props }, item })

export const stateValue = (path: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", ...props }, bind: path })

export const keyCell = (item: string): UiNodeSpec =>
  ({ component: "Table.Cell", children: [rowValue(item)] })
