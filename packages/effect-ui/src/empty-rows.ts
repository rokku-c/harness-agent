import type { UiNodeSpec } from "./spec.ts"
import type { UiCondition } from "./value-spec.ts"
import { sourceStatusPath } from "./source-status.ts"

export const stateRows = (path: string): UiCondition => ({ source: { state: `${path}/0` } })
export const itemRows = (path: string): UiCondition => ({ source: { item: `${path}/0` } })

export const whenRows = (firstRow: UiCondition, node: UiNodeSpec): UiNodeSpec =>
  ({ ...node, visible: firstRow })

export const emptyMessage = (path: string, message: string): UiNodeSpec => ({
  component: "Text",
  props: { value: message, color: "gray", size: "2" },
  visible: { ...stateRows(path), not: true },
})

export const emptyRows = (id: string, path: string, message: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column" },
  visible: { source: { state: `${sourceStatusPath(id)}/answered` }, equals: true },
  children: [emptyMessage(path, message)],
})
