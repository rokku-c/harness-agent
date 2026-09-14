import * as React from "react"
import { Box, Button, Kbd, Text } from "@radix-ui/themes"
import { Glyph } from "./console-glyph.tsx"
import type { CommandRow } from "./console-commands.ts"

export const CommandRowButton = ({ row, active, onPress }: {
  readonly row: CommandRow
  readonly active: boolean
  readonly onPress: () => void
}) =>
  <Button variant="ghost" color="gray" size="2" className="command-palette-row"
    data-active={active ? "on" : undefined} onClick={onPress}>
    <Glyph name={row.glyph} />
    <Text size="2" weight={active ? "medium" : "regular"}>{row.label}</Text>
    {row.caption === undefined ? null : <Text size="1" color="gray">{row.caption}</Text>}
    <Box flexGrow="1" />
    {row.address === undefined ? null
      : <Text size="1" color="gray" className="command-palette-address">{row.address}</Text>}
    {row.shortcut === undefined ? null : <Kbd size="1">{row.shortcut}</Kbd>}
  </Button>
