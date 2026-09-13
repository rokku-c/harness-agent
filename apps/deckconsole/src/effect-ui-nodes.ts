/**
 * The node builders this console is written with. Each one is a shape the page
 * has an opinion about — a field is its label above its control, a section is a
 * card, a list of records is a table — so the opinion lives in one place instead
 * of in every section that happens to need it. The ones the framework states for
 * every console are re-exported from it; the rest are this page's own.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"

export {
  cell, cellOf, field, heading, line, press, section, stateBadge, table, text,
} from "@effect-agent/effect-ui"

/** An identifier addresses a record; it is a key, so it wears the code chip, never the first cell. */
export const code = (item: string): UiNodeSpec => ({ component: "Code", item })
