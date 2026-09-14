/**
 * A table whose rows answer the address.
 *
 * Radix draws a table and the shared vocabulary draws the one every console
 * wanted: a header, a body that repeats, one row per record. What neither has is
 * a row the address that named this screen can narrow, which is what J6 needs —
 * an MCP server read in another app links here filtered to itself, and the filter
 * belongs to the row rather than to a second list beside it.
 *
 * The filter goes on the body, which is the node the repeat sits on, and not on
 * each row: the renderer partitions a repeat element's condition into the part
 * that is the same for every row and the part that is that row's own
 * (`splitRepeatVisibility`), and an `$or` over both is entirely the second kind.
 * Filtering the entries is also the cheaper half — a filter that matches one row
 * draws one row rather than forty hidden ones.
 */
import { table, type UiNodeSpec, type UiRepeatSpec, type UiVisibilitySpec } from "@effect-agent/effect-ui"

/**
 * The address's filter, answered for one row: either nothing is filtered, or
 * this row is the one. The first half compares `$state` and the second `$item`,
 * and both are evaluated per row — so a filter cannot be the reason a list is
 * empty without also being the thing that empties it.
 */
export const filtered = (path: string, field: string): UiVisibilitySpec =>
  ({ any: [
    { source: { state: path }, not: true },
    { source: { item: field }, equals: { state: path } },
  ] })

/**
 * The vocabulary's table, with that filter on the body it already draws. The
 * tree is taken from `table()` rather than rebuilt here, because the table that
 * needed a filter would otherwise be the one table on the page whose headers
 * were drawn differently.
 */
export const filteredTable = (
  headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec, visible: UiVisibilitySpec,
): UiNodeSpec => {
  const drawn = table(headings, cells, repeat)
  const [header, body] = drawn.children ?? []
  return { ...drawn, children: [header!, { ...body!, visible }] }
}
