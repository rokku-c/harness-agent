/**
 * The keyboard list: `?` opens the palette showing this instead of the commands.
 *
 * It is generated from `console-keys.ts`'s registry and not written beside it,
 * which is the only thing that keeps the sheet from lying: §10.3 binds eight
 * keys, the registry holds all eight, and a binding added to the shell without a
 * row in the registry is a binding the sheet cannot mention. That is the whole
 * reason the registry exists.
 *
 * The rows are not controls. A shortcut is something the operator does, not
 * something to press here, and a list of eight buttons that all did nothing
 * would be eight dead ends in an otherwise live list.
 */

import * as React from "react"
import { Box, Flex, Kbd, Text } from "@radix-ui/themes"
import { KEY_MAP } from "./console-keys.ts"
import { matches } from "./console-commands.ts"

export const ConsoleShortcuts = ({ search }: { readonly search: string }) => {
  const rows = KEY_MAP.filter((binding) => matches(`${binding.keys} ${binding.action} ${binding.scope}`, search))
  if (rows.length === 0) return <Text size="2" color="gray" m="2">No key matches that.</Text>
  return <Flex direction="column" gap="3" p="2">
    {rows.map((binding) =>
      <Flex key={binding.keys} align="start" gap="3">
        <Box style={{ flex: "none", minWidth: "6rem" }}><Kbd size="1">{binding.keys}</Kbd></Box>
        <Flex direction="column" gap="1" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Text size="2">{binding.action}</Text>
          <Text size="1" color="gray">{binding.scope}</Text>
        </Flex>
      </Flex>)}
  </Flex>
}
