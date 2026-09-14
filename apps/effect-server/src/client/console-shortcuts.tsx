/**
 * The shortcut sheet: `?`, generated from `console-keys.ts`'s registry.
 *
 * It is generated and not written beside the registry, and that is the only thing
 * that keeps it from lying. §6.3's last rule is that a key not in the registry
 * does not exist; the sheet is the reader's side of that rule, so a binding added
 * without a row is a key nobody can find, and a row added without a binding would
 * be a row teaching a key that does nothing. Neither can happen while this list
 * has exactly one source.
 *
 * It is a layer of its own rather than a mode of the palette, because it is not a
 * list of things to do — nothing here is selectable, and Enter does nothing. §6.2
 * rule 5 still holds: `Escape` closes it and focus returns to whatever opened it,
 * which is Radix's own behaviour for a dialog, and the reason this is a
 * `Dialog.Root` and not a plain box.
 *
 * The search field stays, because a sheet of every key is longer than a dialog:
 * typing narrows it the same way the palette's own search does, with the same
 * every-word rule (`console-command-search.ts`).
 */

import * as React from "react"
import { Box, Dialog, Flex, Kbd, ScrollArea, Text, TextField, VisuallyHidden } from "@radix-ui/themes"
import { LAYER_BOX } from "./console-layer-box.ts"
import { KEY_MAP } from "./console-keys.ts"
import { matches } from "./console-command-search.ts"

export const ConsoleShortcuts = ({ onClose, restore }: {
  readonly onClose: () => void
  /** Where focus goes when the sheet closes. It navigates nowhere, so this is always the opener. */
  readonly restore: () => void
}) => {
  const [search, setSearch] = React.useState("")
  const rows = KEY_MAP.filter((binding) => matches(`${binding.keys} ${binding.action} ${binding.scope}`, search))
  return <Dialog.Root open onOpenChange={(next) => { if (!next) onClose() }}>
    <Dialog.Content style={LAYER_BOX} onCloseAutoFocus={(event) => { event.preventDefault(); restore() }}>
      <VisuallyHidden><Dialog.Title>Keyboard shortcuts</Dialog.Title></VisuallyHidden>
      <TextField.Root size="3" variant="soft" placeholder="Search keys" value={search}
        onChange={(event) => setSearch(event.target.value)} />
      <ScrollArea className="command-palette-list">
        {rows.length === 0
          ? <Text size="2" color="gray" m="2">No key matches that.</Text>
          : <Flex direction="column" gap="3" p="2">
              {rows.map((binding) =>
                <Flex key={binding.keys} align="start" gap="3">
                  <Box style={{ flex: "none", minWidth: "6rem" }}><Kbd size="1">{binding.keys}</Kbd></Box>
                  <Flex direction="column" gap="1" style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <Text size="2">{binding.action}</Text>
                    <Text size="1" color="gray">{binding.scope}</Text>
                  </Flex>
                </Flex>)}
            </Flex>}
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
}
