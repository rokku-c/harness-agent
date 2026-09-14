/**
 * The chrome layer: the bar, the skip link, the palette, and the keys that open it.
 *
 * The shell used to draw the bar itself and know nothing about a keyboard. What
 * is here instead is the one part of the shell that is about the operator rather
 * than about the address: it owns the palette's open state, the control that
 * opened it, and the keys §10.3 binds. The shell keeps what it is good at —
 * resolving an address to a surface — and hands the chrome its title and its
 * body.
 *
 * The opener is remembered as an element and not as a flag, because "focus
 * returns to whatever opened it" is only true if that element is still in the
 * document when the palette closes; a control that has since been unmounted
 * hands focus to the shell body instead of to the document.
 */

import * as React from "react"
import { PLACES, titleOf } from "./console-places.tsx"
import { ConsoleStatusBar } from "./console-status-bar.tsx"
import { ConsolePalette, type PaletteMode } from "./console-palette.tsx"
import { SkipLink } from "./console-skip-link.tsx"
import { useConsoleKeys } from "./console-keyboard.ts"
import { useRouteFocus } from "./console-route-focus.ts"
import { navigate } from "./console-nav.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"

export const ConsoleChrome = ({ plan, route, status, home, body }: {
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  /** The host's status line, as the shell's own read last answered it. */
  readonly status: string
  readonly home: boolean
  /** The shell's body: what a skip link reaches and what a route with no heading focuses. */
  readonly body: React.RefObject<HTMLDivElement | null>
}) => {
  const [palette, setPalette] = React.useState<PaletteMode | null>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const openPalette = React.useCallback((mode: PaletteMode) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPalette(mode)
  }, [])
  const closePalette = React.useCallback(() => setPalette(null), [])
  const restore = React.useCallback(() => {
    const control = opener.current
    if (control !== null && control.isConnected) control.focus({ preventScroll: true })
    else body.current?.focus({ preventScroll: true })
  }, [body])
  useConsoleKeys({
    paletteOpen: palette !== null,
    openPalette: React.useCallback(() => openPalette("commands"), [openPalette]),
    openShortcuts: React.useCallback(() => openPalette("shortcuts"), [openPalette]),
    closePalette,
    goHome: React.useCallback(() => navigate({ kind: "home" }), []),
    goSettings: React.useCallback(() => navigate({ kind: "settings" }), []),
  })
  useRouteFocus(route, body)
  return <>
    <SkipLink target={body} />
    <ConsoleStatusBar status={status} title={titleOf(route, plan)} home={home}
      onPalette={() => openPalette("commands")} />
    {/* Keyed by mode, so `?` on an open palette is the sheet and not the same list re-titled. */}
    {palette === null ? null : <ConsolePalette key={palette} mode={palette} plan={plan} route={route}
      places={PLACES} onClose={closePalette} restore={restore} />}
  </>
}
