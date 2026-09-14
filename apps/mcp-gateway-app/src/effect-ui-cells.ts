import { cellOf, chip, type UiNodeSpec } from "@effect-agent/effect-ui"

export const titled = (name: string, id: string): UiNodeSpec =>
  cellOf({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name, props: { weight: "medium" }, visible: { source: { item: name } } },
    chip(id),
  ] })

export const chipWhen = (item: string): UiNodeSpec =>
  ({ ...chip(item), visible: { source: { item } } })

export const chipRow = (items: readonly string[]): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "2", align: "center", wrap: "wrap" }, children: items.map(chipWhen) })
