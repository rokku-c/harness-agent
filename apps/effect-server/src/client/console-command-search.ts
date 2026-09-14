/**
 * Narrowing the palette's rows to a query, and ordering what is left.
 *
 * Two rules from §6.4, and they are the reason this is a file rather than four
 * lines inside the palette.
 *
 * The match is **every word, anywhere in the row** (rule 4). One term per word and
 * all of them must appear, so a space is how an operator reaches the rest of the
 * host: `board task` is the Task screen of the app called Board, whichever group
 * it is filed under, and the term naming an app is not a special case the search
 * has to know about. What a row is matched against is its label, its caption, its
 * address and its key — so an operation is findable by its name because the
 * address carries it, and a shortcut is findable by the key it is bound to.
 *
 * The order is **scoped first**: the open app's own rows ahead of the rest, in a
 * stable partition so that within each half §6.4's group order survives. That is
 * the whole of "the current app's screens and actions are already at the top".
 */

import type { CommandRow } from "./console-commands.ts"

/**
 * One term per word, and every one of them must appear.
 */
export const matches = (text: string, query: string): boolean => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter((term) => term !== "")
  const haystack = text.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** What a row can be found by: what it reads as, what it is, where it goes, and its key. */
const textOf = (row: CommandRow): string =>
  `${row.label} ${row.caption} ${row.address ?? ""} ${row.shortcut ?? ""}`

/**
 * The rows for a query. A query with nothing in it matches everything, so the
 * palette opens on the full list rather than on a blank pane.
 */
export const filterCommands = (
  rows: readonly CommandRow[],
  query: string,
  open: string | undefined,
): readonly CommandRow[] => {
  const matched = rows.filter((row) => matches(textOf(row), query))
  return open === undefined
    ? matched
    : [...matched.filter((row) => row.owner === open), ...matched.filter((row) => row.owner !== open)]
}
