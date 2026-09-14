import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyRows, failureNotice, heading, loadingRows, stateRows, table, text, whenRows } from "@effect-agent/effect-ui"

export const MODEL_SOURCE = "models"

export const mono = (field: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { variant: "ghost", size: "2", ...props }, item: field })
export const monoBind = (bind: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { variant: "ghost", size: "2", ...props }, bind })

export const note = (value: string): UiNodeSpec => text(value, { size: "2", color: "gray" })

export const caption = (value: string): UiNodeSpec => text(value, { size: "1", color: "gray" })

export const block = (title: string, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "3" }, children: [heading(title, { size: "3" }), ...children] })

export const listRows = (headings: readonly string[], cells: readonly UiNodeSpec[], path: string, empty: string, key?: string): readonly UiNodeSpec[] => [
  emptyRows(MODEL_SOURCE, path, empty),
  whenRows(stateRows(path), table(headings, cells, { source: { state: path }, ...(key === undefined ? {} : { key }) })),
]

export const readState: readonly UiNodeSpec[] = [loadingRows(MODEL_SOURCE), failureNotice(MODEL_SOURCE)]
