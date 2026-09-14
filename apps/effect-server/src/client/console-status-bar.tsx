import * as React from "react"
import { Box, Button, Flex, IconButton, Kbd, Text, Tooltip } from "@radix-ui/themes"
import { Glyph } from "./console-glyph.tsx"
import { modKey } from "./console-keys.ts"
import { nextThemeMode, themeLabel } from "./theme-runtime.ts"
import { useThemeMode } from "./theme-appearance.ts"
import { navigate } from "./console-nav.ts"

const clockText = (): string => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())

const AppearanceButton = () => {
  const [mode, setMode] = useThemeMode()
  const label = `Appearance: ${themeLabel(mode)}`
  return <Tooltip content={label}>
    <IconButton size="1" variant="ghost" color="gray" aria-label={label}
      onClick={() => setMode(nextThemeMode(mode))}><Glyph name="CircleHalf" /></IconButton>
  </Tooltip>
}

/** §10.2's palette trigger: the glyph, and the key that does the same thing from anywhere. */
const PaletteButton = ({ onPalette }: { readonly onPalette: () => void }) =>
  <Button variant="soft" size="1" aria-label="Open the command palette" onClick={onPalette}>
    <Glyph name="MagnifyingGlass" /><Kbd className="shell-bar-key" size="1">{`${modKey()}+K`}</Kbd>
  </Button>

/**
 * The brand strip: where this console is, what the host is doing, and the local
 * time. The title is the open surface's name, because that is the one place it
 * is said while an app has the page to itself.
 *
 * The Home control is the whole of the way back from an app screen, so it is not
 * drawn on Home itself: a control that goes where the reader already is reads as
 * a destination, and this one has none.
 *
 * Every control here is a glyph and never a character (§8 rule 2): the two the
 * bar used to draw as text are `House` and `CircleHalf` now, and no emoji and no
 * textual stand-in is left in the chrome.
 *
 * §10.2.1's geometry is the `shell-bar` class, and the one rule it needs a
 * stylesheet for is the narrow one: below 700 px the status line and the shortcut
 * hint are hidden and the trigger is left as the glyph a reader presses. That is
 * CSS and not a breakpoint listener because it is the same control either way —
 * an `IconButton` rendered beside this one would be a second control with the
 * same name, which is a worse answer than a narrower first one.
 */
export const ConsoleStatusBar = ({ status, title, home, onPalette }: {
  readonly status: string
  readonly title: string
  readonly home: boolean
  /** What the palette trigger does. The key does the same thing from anywhere. */
  readonly onPalette: () => void
}) => {
  const [clock, setClock] = React.useState(clockText)
  React.useEffect(() => { const timer = setInterval(() => setClock(clockText()), 30_000); return () => clearInterval(timer) }, [])
  return <Flex className="shell-bar" align="center" gap="3" px="3" flexShrink="0">
    {home ? null : <Tooltip content="Home">
      <IconButton size="1" variant="ghost" aria-label="Home"
        onClick={() => navigate({ kind: "home" })}><Glyph name="House" /></IconButton>
    </Tooltip>}
    <Text size="2" weight="bold" truncate>{title}</Text>
    <Text className="shell-bar-status" size="1" color="gray" truncate>{status}</Text>
    <Box flexGrow="1" />
    <PaletteButton onPalette={onPalette} />
    <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>{clock}</Text>
    <AppearanceButton />
  </Flex>
}
