import * as React from "react"
import type { CommandRow } from "./console-commands.ts"

const within = (index: number, length: number): number => length === 0 ? 0 : Math.min(index, length - 1)

export interface CommandCursor {
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
