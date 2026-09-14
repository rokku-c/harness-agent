import * as React from "react"
import { PLACES } from "./console-places.tsx"
import { titleOf } from "./console-titles.ts"
import { ConsoleStatusBar } from "./console-status-bar.tsx"
import { ConsolePalette } from "./console-palette.tsx"
import { ConsoleShortcuts } from "./console-shortcuts.tsx"
import { SkipLink } from "./console-skip-link.tsx"
import { ConsoleLiveRegion } from "./console-live-region.tsx"
import { useRouteAnnouncement } from "./console-live.ts"
import { useConsoleKeys } from "./console-keyboard.ts"
import { useConsoleEscape } from "./console-escape.ts"
import { useConsoleMoves } from "./console-actions.ts"
import { useLayer } from "./console-layers.ts"
import { useRouteFocus } from "./console-route-focus.ts"
import { rememberApp } from "./console-goto.ts"
import type { PaletteMode } from "./console-commands.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"

export const ConsoleChrome = ({ plan, route, status, home, body }: {
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  readonly status: string
  readonly home: boolean
  readonly body: React.RefObject<HTMLDivElement | null>
}) => {
  const { layer, open, replace, close, restore } = useLayer(body)
  const moves = useConsoleMoves(route, body)
  React.useEffect(() => { rememberApp(route) }, [route])
  useConsoleKeys({
    paletteOpen: layer?.kind === "palette",
    openPalette: React.useCallback((mode: PaletteMode) => open({ kind: "palette", mode }), [open]),
    closePalette: close,
    openShortcuts: React.useCallback(() => open({ kind: "shortcuts" }), [open]),
    ...moves,
  })
  useConsoleEscape(moves.back)
  useRouteFocus(route, body)
  useRouteAnnouncement(route.kind, titleOf(route, plan, PLACES))
  const drawer = layer === null ? null
    : layer.kind === "shortcuts" ? <ConsoleShortcuts onClose={close} restore={restore} />
      : <ConsolePalette key={layer.mode} mode={layer.mode} plan={plan} route={route}
          places={PLACES} onClose={close} restore={restore}
          onShortcuts={() => replace({ kind: "shortcuts" })} />
  return <>
    <SkipLink target={body} />
    <ConsoleLiveRegion />
    <ConsoleStatusBar status={status} title={titleOf(route, plan, PLACES)} home={home}
      onPalette={() => open({ kind: "palette", mode: "commands" })} />
    {drawer}
  </>
}
