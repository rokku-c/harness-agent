/**
 * The node builders both mantis surfaces are written with.
 *
 * A field is its label above its control, a section is a card, a list of records
 * is a table: those are opinions the framework states once, in
 * `@effect-agent/effect-ui`, and they are re-exported here so a section of this
 * app names one place for its shapes. What is left below is what this console
 * has an opinion of its own about.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"

export { cell, cellOf, field, heading, list, line, section, stateBadge, table, text } from "@effect-agent/effect-ui"

/** An identifier is a key, not content, so a cell that holds one is a chip. */
export const codeCell = (item: string): UiNodeSpec =>
  ({ component: "Table.Cell", children: [{ component: "Code", item }] })
