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

const openApp = (route: ConsoleRoute): string | undefined =>
  route.kind === "app" || route.kind === "app-settings" ? route.id : undefined

export const ConsolePalette = ({ mode, plan, route, places, onClose, onShortcuts, restore }: {
  readonly mode: PaletteMode
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  readonly places: readonly Place[]
  readonly onClose: () => void
  readonly onShortcuts: () => void
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
