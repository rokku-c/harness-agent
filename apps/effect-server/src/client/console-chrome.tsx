/**
 * The chrome layer: the bar, the skip link, the two layers, and the keys that
 * open them.
 *
 * The shell used to draw the bar itself and know nothing about a keyboard. What
 * is here instead is the one part of the shell that is about the operator rather
 * than about the address: it owns which layer is up and the control that opened
 * it (`console-layers.ts`), what the moving keys do (`console-actions.ts`), and
 * nothing else. The shell keeps what it is good at — resolving an address to a
 * surface — and hands the chrome its title and its body.
 *
 * `g l` and the place chords are why the app slot is written on every route the
 * shell resolves (`console-goto.ts`): the key knows where the operator last was
 * without the chrome keeping a second record of where they are, which is the same
 * standing the address bar has.
 */

import * as React from "react"
import { PLACES } from "./console-places.tsx"
import { titleOf } from "./console-titles.ts"
import { ConsoleStatusBar } from "./console-status-bar.tsx"
import { ConsolePalette } from "./console-palette.tsx"
import { ConsoleShortcuts } from "./console-shortcuts.tsx"
import { SkipLink } from "./console-skip-link.tsx"
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
  /** The host's status line, as the shell's own read last answered it. */
  readonly status: string
  readonly home: boolean
  /** The shell's body: what a skip link reaches and what a route with no heading focuses. */
  readonly body: React.RefObject<HTMLDivElement | null>
}) => {
  const { layer, open, replace, close, restore } = useLayer(body)
  const moves = useConsoleMoves(route, body)
  React.useEffect(() => { rememberApp(route) }, [route])
  useConsoleKeys({
    // Only the palette, not "a layer": `Mod+K` closes the palette it opened and
    // replaces the shortcut sheet, which it did not (`console-keyboard.ts`).
    paletteOpen: layer?.kind === "palette",
    openPalette: React.useCallback((mode: PaletteMode) => open({ kind: "palette", mode }), [open]),
    closePalette: close,
    openShortcuts: React.useCallback(() => open({ kind: "shortcuts" }), [open]),
    ...moves,
  })
  useConsoleEscape(moves.back)
  useRouteFocus(route, body)
  // Keyed by mode, so `Mod+P` on an open palette is the same field in the other mode.
  const drawer = layer === null ? null
    : layer.kind === "shortcuts" ? <ConsoleShortcuts onClose={close} restore={restore} />
      : <ConsolePalette key={layer.mode} mode={layer.mode} plan={plan} route={route}
          places={PLACES} onClose={close} restore={restore}
          onShortcuts={() => replace({ kind: "shortcuts" })} />
  return <>
    <SkipLink target={body} />
    <ConsoleStatusBar status={status} title={titleOf(route, plan, PLACES)} home={home}
      onPalette={() => open({ kind: "palette", mode: "commands" })} />
    {drawer}
  </>
}
