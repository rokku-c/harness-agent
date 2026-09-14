/**
 * The command palette: one `Dialog`, one search field, one list, two modes (§10.3,
 * §6.4).
 *
 * Mounted only while it is open, which is what makes its three reads free the rest
 * of the time: the open app's screens and declared actions, every registered
 * operation, and the decisions that are waiting are fetched for its groups, and
 * nothing fetches them while the palette is closed. They are fetched together on
 * purpose — a palette whose rows appeared one group at a time would reorder itself
 * under the operator's cursor while they were reading it.
 *
 * The address row is built here rather than in `console-commands.ts` because
 * resolving an address is the surfaces' question (`console-palette-address.tsx`),
 * and it is put in front of the rest: a pasted address is the query's most literal
 * answer, and §6.4 rule 3 makes it the one row that is a link the reader already
 * had.
 *
 * Focus goes where the operator expects on the way out. A row that navigated
 * leaves focus to the route's heading, by the rule every other route change
 * follows; a row that only acted hands focus back to whatever opened the palette
 * (§6.4 rule 5). Radix's close-auto-focus is suppressed for exactly that reason —
 * left alone it restores to a trigger this palette does not have, and focus would
 * land on the document. `Escape` is Radix's, not ours: it closes this dialog and
 * restores focus, and the console's own handler stands aside while a layer is open
 * (`console-escape.ts`).
 */

import * as React from "react"
import { Dialog, Flex, ScrollArea, Text, TextField, VisuallyHidden } from "@radix-ui/themes"
import { CommandRowButton } from "./console-command-row.tsx"
import { LAYER_BOX } from "./console-layer-box.ts"
import { commandRows, type PaletteMode } from "./console-commands.ts"
import { filterCommands } from "./console-command-search.ts"
import { addressRow } from "./console-palette-address.tsx"
import { useOpenView, useOperations, useWaitingDecisions } from "./console-palette-reads.ts"
import { useCommandRun } from "./console-command-run.ts"
import { useCommandCursor } from "./console-command-cursor.ts"
import { useThemeMode } from "./theme-appearance.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"

/** The app whose view is mounted, if any: the only app whose actions this palette can run. */
const openApp = (route: ConsoleRoute): string | undefined =>
  route.kind === "app" || route.kind === "app-settings" ? route.id : undefined

export const ConsolePalette = ({ mode, plan, route, places, onClose, onShortcuts, restore }: {
  readonly mode: PaletteMode
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  readonly places: readonly Place[]
  readonly onClose: () => void
  /** The Console group's "Keyboard shortcuts" row: the sheet is a layer of its own. */
  readonly onShortcuts: () => void
  /** Where focus goes when the palette closes without having navigated. */
  readonly restore: () => void
}) => {
  const [search, setSearch] = React.useState("")
  const open = openApp(route)
  const view = useOpenView(open)
  const operations = useOperations()
  const decisions = useWaitingDecisions()
  const [, setTheme] = useThemeMode()
  const { run, navigated } = useCommandRun(onClose, onShortcuts, setTheme)
  const rows = React.useMemo(() => {
    const ranked = filterCommands(commandRows({ plan, route, places, open, view, operations, decisions, mode }), search, open)
    const address = addressRow(search, plan, places)
    return address === undefined ? ranked : [address, ...ranked]
  }, [plan, route, places, open, view, operations, decisions, mode, search])
  const cursor = useCommandCursor(rows, run)
  return <Dialog.Root open onOpenChange={(next) => { if (!next) onClose() }}>
    <Dialog.Content style={LAYER_BOX} onKeyDown={cursor.onKeyDown}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (!navigated.current) restore() }}>
      <VisuallyHidden><Dialog.Title>Command palette</Dialog.Title></VisuallyHidden>
      <TextField.Root size="3" variant="soft" placeholder="Search apps, screens and settings" value={search}
        onChange={(event) => { setSearch(event.target.value); cursor.reset() }} />
      <ScrollArea ref={cursor.list} className="command-palette-list">
        <Flex direction="column" gap="1" p="1">
          {rows.length === 0 ? <Text size="2" color="gray" m="2">No command matches that.</Text>
            : rows.map((row, index) => <CommandRowButton key={row.id} row={row} active={cursor.activeAt(index)} onPress={() => run(row)} />)}
        </Flex>
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
}
