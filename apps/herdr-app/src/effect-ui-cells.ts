import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, row } from "./effect-ui-nodes.ts"

export const mono = (field: string): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", variant: "soft" }, item: field })

export const monoCell = (field: string): UiNodeSpec => cellOf([mono(field)])

export const identity = (name: string, id: string): UiNodeSpec => cellOf([
  { component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name }, mono(id),
  ] },
])

export const kindBadge = (field: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "blue", highContrast: true }, item: field })

export const stateBadge = (field: string): UiNodeSpec => row([
  { component: "Badge", props: { variant: "soft", color: "amber", highContrast: true }, item: field,
    visible: { source: { item: field }, equals: "blocked" } },
  { component: "Badge", props: { variant: "soft" }, item: field,
    visible: { source: { item: field }, equals: "blocked", not: true } },
])

export const stateCell = (field: string): UiNodeSpec => cellOf([stateBadge(field)])

export const frontCell = (field: string): UiNodeSpec => cellOf([
  { component: "Text", props: { value: "in front", size: "2" }, visible: { source: { item: field } } },
  { component: "Text", props: { value: "behind", size: "2", color: "gray" },
    visible: { source: { item: field }, not: true } },
])

export const openCell: UiNodeSpec = cellOf([
  row([{ component: "Button", props: { value: "Open", size: "1", variant: "soft" },
    onPress: "herdr.openAgent", params: { target: { item: "pane_id" } } }]),
])
