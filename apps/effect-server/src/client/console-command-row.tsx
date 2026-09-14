/**
 * One row of the command palette: a glyph, a label, an optional caption, the
 * address it goes to, and the key the console already binds for it.
 *
 * The glyph arrives as a name and is resolved by `console-glyph.tsx` at §8's
 * chrome size and weight. A row with a mark the console does not know draws
 * nothing rather than a stand-in character, and that is honest: the vocabulary
 * is closed on purpose, and an invented mark is one nothing chose.
 *
 * The address is not decoration. §6.4 rule 6 asks every result to show where it
 * goes, so the palette teaches the address space instead of hiding it — an
 * operator who has pasted three links out of the palette has learned the shape of
 * the console's own links. It is muted and truncatable, because a row that only
 * acts has none and a row that goes somewhere must not wrap to two lines to say
 * so.
 *
 * The row is a ghost `Button`, so it is in the tab order and takes the system's
 * own focus ring; what the arrow keys move is a cursor of the palette's own,
 * marked with `data-active` rather than with focus, because focus stays in the
 * search field where the operator's typing goes.
 */

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
