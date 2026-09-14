/**
 * The command palette: one `Dialog`, one search field, one list (§10.3).
 *
 * Mounted only while it is open, which is what makes its two reads free the rest
 * of the time: the open app's screens are fetched for its second group, and
 * nothing fetches them while the palette is closed.
 *
 * Focus goes where the operator expects on the way out. A row that navigated
 * leaves focus to the route's heading, by the rule every other route change
 * follows; a row that only acted hands focus back to whatever opened the palette.
 * Radix's close-auto-focus is suppressed for exactly that reason — left alone it
 * restores to a trigger this palette does not have, and focus would land on the
 * document. `Escape` is Radix's, not ours: it closes this dialog and restores
 * focus, and the console binds no handler for it, so with nothing open it does
 * nothing at all.
 */

import * as React from "react"
import { Dialog, Flex, ScrollArea, Text, TextField, VisuallyHidden } from "@radix-ui/themes"
import { CommandRowButton } from "./console-command-row.tsx"
import { ConsoleShortcuts } from "./console-shortcuts.tsx"
import { commandRows, filterCommands, type CommandRow } from "./console-commands.ts"
import { useAppScreens } from "./console-app-screens.ts"
import { navigate } from "./console-nav.ts"
import { readNow } from "./console-read-now.ts"
import { useThemeMode } from "./theme-appearance.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"

export type PaletteMode = "commands" | "shortcuts"

/** §10.3's geometry, inline so that no stylesheet order can move it off its anchor. */
const BOX: React.CSSProperties = {
  position: "fixed", top: "12vh", left: "50%", transform: "translateX(-50%)",
  width: "min(560px, calc(100vw - 32px))", maxWidth: "none",
  background: "var(--color-panel-solid)", borderRadius: "var(--radius-5)", boxShadow: "var(--shadow-3)",
}

export const ConsolePalette = ({ mode, plan, route, places, onClose, restore }: {
  readonly mode: PaletteMode
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  readonly places: readonly Place[]
  readonly onClose: () => void
  /** Where focus goes when the palette closes without having navigated. */
  readonly restore: () => void
}) => {
  const [view, setView] = React.useState(mode)
  const [search, setSearch] = React.useState("")
  const [cursor, setCursor] = React.useState(0)
  const list = React.useRef<HTMLDivElement>(null)
  const navigated = React.useRef(false)
  const screens = useAppScreens(route.kind === "app" ? route.id : undefined)
  const [, setTheme] = useThemeMode()
  const rows = React.useMemo(() => filterCommands(commandRows({ plan, route, screens, places }), search), [plan, route, screens, places, search])
  const run = React.useCallback((row: CommandRow): void => {
    switch (row.action.kind) {
      case "go": navigated.current = true; onClose(); navigate(row.action.route); return
      case "appearance": setTheme(row.action.mode); onClose(); return
      case "read": readNow(); onClose(); return
      case "shortcuts": setView("shortcuts"); setSearch(""); setCursor(0); return
    }
  }, [onClose, setTheme])
  // The cursor is not focus, so the browser will not scroll to it: this is what keeps
  // the highlighted row on screen while the operator's hands stay in the search field.
  React.useEffect(() => { list.current?.querySelector('[data-active="on"]')?.scrollIntoView({ block: "nearest" }) }, [cursor, rows])
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (view !== "commands") return
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
  return <Dialog.Root open onOpenChange={(next) => { if (!next) onClose() }}>
    <Dialog.Content style={BOX} onKeyDown={onKeyDown}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (!navigated.current) restore() }}>
      <VisuallyHidden>
        <Dialog.Title>{view === "shortcuts" ? "Keyboard shortcuts" : "Command palette"}</Dialog.Title>
      </VisuallyHidden>
      <TextField.Root size="3" variant="soft" placeholder="Search apps, screens and settings" value={search}
        onChange={(event) => { setSearch(event.target.value); setCursor(0) }} />
      <ScrollArea ref={list} className="command-palette-list">
        <Flex direction="column" gap="1" p="1">
          {view === "shortcuts" ? <ConsoleShortcuts search={search} />
            : rows.length === 0 ? <Text size="2" color="gray" m="2">No command matches that.</Text>
              : rows.map((row, index) => <CommandRowButton key={row.id} row={row} active={index === cursor} onPress={() => run(row)} />)}
        </Flex>
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
}
