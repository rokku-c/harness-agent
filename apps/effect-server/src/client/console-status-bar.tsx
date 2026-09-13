import * as React from "react"
import { Box, Flex, IconButton, Text, Tooltip } from "@radix-ui/themes"
import { themeLabel } from "./theme-runtime.ts"
import { useThemeMode } from "./theme-appearance.ts"
import { navigate } from "./console-nav.ts"

const clockText = (): string => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())

const AppearanceButton = () => {
  const [mode, cycle] = useThemeMode()
  const label = `Appearance: ${themeLabel(mode)}`
  return <Tooltip content={label}>
    <IconButton size="1" variant="ghost" color="gray" aria-label={label} onClick={cycle}>◐</IconButton>
  </Tooltip>
}

/**
 * The brand strip: where this console is, what the host is doing, and the local
 * time. The title is the open surface's name, because that is the one place it
 * is said while an app has the page to itself.
 *
 * The Home control is the whole of the way back from an app screen, so it is not
 * drawn on Home itself: a control that goes where the reader already is reads as
 * a destination, and this one has none.
 */
export const ConsoleStatusBar = ({ status, title, home }: {
  readonly status: string
  readonly title: string
  readonly home: boolean
}) => {
  const [clock, setClock] = React.useState(clockText)
  React.useEffect(() => { const timer = setInterval(() => setClock(clockText()), 30_000); return () => clearInterval(timer) }, [])
  return <Flex align="center" gap="3" px="3" py="2" flexShrink="0">
    {home ? null : <Tooltip content="Home">
      <IconButton size="1" variant="ghost" aria-label="Home" onClick={() => navigate({ kind: "home" })}>⌂</IconButton>
    </Tooltip>}
    <Text size="2" weight="bold" truncate>{title}</Text>
    <Text size="1" color="gray" truncate>{status}</Text>
    <Box flexGrow="1" />
    <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>{clock}</Text>
    <AppearanceButton />
  </Flex>
}
