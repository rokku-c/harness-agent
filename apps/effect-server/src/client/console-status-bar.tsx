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

const PaletteButton = ({ onPalette }: { readonly onPalette: () => void }) =>
  <Button variant="soft" size="1" aria-label="Open the command palette" onClick={onPalette}>
    <Glyph name="MagnifyingGlass" /><Kbd className="shell-bar-key" size="1">{`${modKey()}+K`}</Kbd>
  </Button>

export const ConsoleStatusBar = ({ status, title, home, onPalette }: {
  readonly status: string
  readonly title: string
  readonly home: boolean
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
