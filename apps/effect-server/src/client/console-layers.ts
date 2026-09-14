/**
 * Which layer is up, one at a time, and where focus goes when it goes away.
 *
 * §6.3 gives the console two layers — the command palette in its two modes and the
 * shortcut sheet — and one key that closes whichever is showing. So the state is
 * one slot rather than a set of booleans: two flags would allow a state the keys
 * have no name for, and the reader would be left pressing `Escape` at a stack.
 * Opening one from another replaces it for the same reason.
 *
 * The opener is remembered as an *element* and not as a flag, because §6.2 rule 5
 * and §6.4 rule 5 both ask focus to return to whatever opened the layer, and that
 * is only true if the element is still in the document when the layer closes. One
 * that has been unmounted in the meantime hands focus to the shell body instead of
 * to the document — which is the difference between a keyboard user continuing and
 * starting over.
 *
 * `replace` exists for the one move between two layers: the palette's Console
 * group opens the sheet, and the opener must stay the control that opened the
 * palette, so the reader who closes the sheet lands back where they started rather
 * than on a search field that no longer exists.
 */

import * as React from "react"
import type { PaletteMode } from "./console-commands.ts"

export type Layer = { readonly kind: "palette"; readonly mode: PaletteMode } | { readonly kind: "shortcuts" }

export interface LayerState {
  readonly layer: Layer | null
  /** Opens a layer, remembering what to give focus back to. */
  readonly open: (next: Layer) => void
  /** Swaps one layer for another without moving the opener. */
  readonly replace: (next: Layer) => void
  readonly close: () => void
  readonly restore: () => void
}

export const useLayer = (body: React.RefObject<HTMLElement | null>): LayerState => {
  const [layer, setLayer] = React.useState<Layer | null>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const open = React.useCallback((next: Layer) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setLayer(next)
  }, [])
  const replace = React.useCallback((next: Layer) => setLayer(next), [])
  const close = React.useCallback(() => setLayer(null), [])
  const restore = React.useCallback(() => {
    const control = opener.current
    if (control !== null && control.isConnected) control.focus({ preventScroll: true })
    else body.current?.focus({ preventScroll: true })
  }, [body])
  return { layer, open, replace, close, restore }
}
