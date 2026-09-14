import type { CommandRow } from "./console-commands.ts"

export const matches = (text: string, query: string): boolean => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter((term) => term !== "")
  const haystack = text.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

const textOf = (row: CommandRow): string =>
  `${row.label} ${row.caption} ${row.address ?? ""} ${row.shortcut ?? ""}`

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
