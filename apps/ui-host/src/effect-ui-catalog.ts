import type { UiNodeSpec, UiRepeatSpec } from "@effect-agent/effect-ui"
import { sourceStates } from "@effect-agent/effect-ui"
import { cell, section, table, text } from "./effect-ui-nodes.ts"

/**
 * What the runtime can draw with: the component types its definition store
 * carries, and the extensions registered beside them.
 *
 * One card, because the two tables answer one question an operator asks once —
 * what is available to put on a canvas — and a page of two adjacent headings
 * over two static inventories reads as two subjects. Each list keeps its own
 * source verdicts and its own empty notice: either one can be empty while the
 * other is not.
 */
const inventory = (title: string, id: string, empty: string, headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "2" }, children: [
    text(title, { size: "2", weight: "medium" }),
    ...sourceStates(id, empty),
    table(headings, cells, repeat),
  ] })

export const catalogSection: UiNodeSpec = section("Catalog", [
  inventory("Components", "components", "No component types are registered yet.",
    ["Type", "Version"], [cell("type"), cell("version")], { source: { state: "/components" }, key: "type" }),
  inventory("Extensions", "extensions", "No extensions are registered yet.",
    ["Name", "Version"], [cell("name"), cell("version")], { source: { state: "/extensions" }, key: "name" }),
])
