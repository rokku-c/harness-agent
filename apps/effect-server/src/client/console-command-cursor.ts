/**
 * The palette's cursor: which row `Enter` runs, and how the arrow keys move it.
 *
 * It is a cursor and not focus. The operator's hands stay in the search field —
 * that is the whole point of a palette, and moving focus onto rows would take the
 * next keystroke away from the query — so the row the cursor is on is *drawn* as
 * current (`data-active`, `console-command-row.tsx`) and focus never leaves the
 * field it is in.
 *
 * Which means the browser does not scroll it into view, because the browser
 * scrolls what it focuses. So the second half of this file is that missing move,
 * and it is a `block: "nearest"` on purpose: a list that re-centred itself on
 * every arrow press would slide under the operator's eyes while they were reading
 * it, and a list that never moved would let the cursor leave the window.
 *
 * `Home` and `End` are §6.3's keys for a list and are not here: the registry has
 * no row for them yet, and a binding without a row is a key the sheet cannot
 * mention (`console-keys.ts`). They arrive with the lists that own them.
 *
 * The cursor is kept inside the list, and that is not the arrow keys' doing
 * alone: the rows change under a reader who is not typing, because three of the
 * palette's groups arrive from reads that land when they land. A cursor left past
 * the end of a shorter list would make `Enter` do nothing at all — a press that
 * silently does not happen is the one failure a keyboard surface must not have —
 * so every change of length brings it back into range.
 */

import * as React from "react"
import type { CommandRow } from "./console-commands.ts"

/** A cursor that is always an index of the list it is a cursor of. */
const within = (index: number, length: number): number => length === 0 ? 0 : Math.min(index, length - 1)

export interface CommandCursor {
  /** Back to the top, for a query that just changed the rows under it. */
  readonly reset: () => void
  readonly list: React.RefObject<HTMLDivElement | null>
  readonly onKeyDown: (event: React.KeyboardEvent) => void
  readonly activeAt: (index: number) => boolean
}

export const useCommandCursor = (rows: readonly CommandRow[], run: (row: CommandRow) => void): CommandCursor => {
  const [cursor, setCursor] = React.useState(0)
  const list = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { setCursor((current) => within(current, rows.length)) }, [rows.length])
  React.useEffect(() => { list.current?.querySelector('[data-active="on"]')?.scrollIntoView({ block: "nearest" }) }, [cursor, rows])
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (rows.length === 0) return
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : rows.length - 1
      setCursor((current) => (current + step) % rows.length)
      return
    }
    if (event.key !== "Enter") return
    const row = rows[cursor]
    if (row === undefined) return
    event.preventDefault()
    run(row)
  }
  return {
    reset: React.useCallback(() => setCursor(0), []),
    list,
    onKeyDown,
    activeAt: React.useCallback((index: number) => index === cursor, [cursor]),
  }
}
