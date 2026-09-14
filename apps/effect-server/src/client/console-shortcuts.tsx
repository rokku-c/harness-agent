import * as React from "react"
import { Box, Dialog, Flex, Kbd, ScrollArea, Text, TextField, VisuallyHidden } from "@radix-ui/themes"
import { LAYER_BOX } from "./console-layer-box.ts"
import { KEY_MAP } from "./console-keys.ts"
import { matches } from "./console-command-search.ts"

export const ConsoleShortcuts = ({ onClose, restore }: {
  readonly onClose: () => void
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
