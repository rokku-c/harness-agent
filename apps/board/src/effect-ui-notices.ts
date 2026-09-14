import { emptyMessage, emptyRows, press, row, sourceStatusPath, type UiNodeSpec } from "@effect-agent/effect-ui"
import { hidingSome } from "./effect-ui-filter.ts"

type Visible = UiNodeSpec["visible"]

const status = sourceStatusPath("table")

const failed: Visible = { source: { state: `${status}/state` }, equals: "failed" }
const empty: Visible = { source: { state: `${status}/state` }, equals: "empty" }
const ready: Visible = { source: { state: `${status}/state` }, equals: "ready" }
export const answered: Visible = { source: { state: `${status}/answered` }, equals: true }

const under = (visible: Visible, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column" }, visible, children: [...children] })

export const readFailure: readonly UiNodeSpec[] = [
  { component: "Callout.Root", props: { color: "red", size: "1", highContrast: true }, visible: failed, children: [
    { component: "Callout.Text", props: { value: "Could not read the task table." } },
    { component: "Callout.Text", props: { value: "Showing the last read that landed." }, visible: answered },
    { component: "Callout.Text", children: [{ component: "Code", props: { size: "1" }, bind: `${status}/error` }] },
  ] },
  row([{ ...press("Try again", "board.retry", undefined, { variant: "soft", size: "1" }), visible: failed }]),
]

export const emptyBoard: UiNodeSpec =
  { ...emptyRows("table", "/table/rows", "No task is on the board. Open New task to add one."), visible: empty }

export const filterEmpty: UiNodeSpec =
  under(ready, [under(hidingSome,
    [emptyMessage("/table/rows", "No task matches this filter. Choose All and empty the field to see every task.")])])

export const boardEmptiness: readonly UiNodeSpec[] = [emptyBoard, filterEmpty]
