/**
 * The two cells that are not one value.
 *
 * `titled` is a record's name over the id the server addresses it by. The two
 * stack rather than run together, because a table cell is a `<td>` and its
 * children would otherwise share one line — and because a title over its caption
 * is a row shape §2 already gives a height to. The name is guarded on the
 * record's own field, so a principal registered without one reads as its key
 * alone rather than as a blank line above it.
 *
 * `chipWhen` is a value shown only where the record carries one. A `<td>` holds
 * inline children, and an empty one is not invisible: `Code` draws its own
 * padding and ground, so an absent id would paint as an empty chip — a value the
 * reader can see and cannot read. The id is mono at body size, which is §4's rule
 * that a value in a row is never one step down from the prose beside it.
 */
import { cellOf, chip, type UiNodeSpec } from "@effect-agent/effect-ui"

export const titled = (name: string, id: string): UiNodeSpec =>
  cellOf({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name, props: { weight: "medium" }, visible: { source: { item: name } } },
    chip(id),
  ] })

export const chipWhen = (item: string): UiNodeSpec =>
  ({ ...chip(item), visible: { source: { item } } })

/** Several ids that belong together, spaced apart rather than run into one another. */
export const chipRow = (items: readonly string[]): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "2", align: "center", wrap: "wrap" }, children: items.map(chipWhen) })
