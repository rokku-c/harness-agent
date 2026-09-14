import * as React from "react"
import type { PaletteMode } from "./console-commands.ts"

export type Layer = { readonly kind: "palette"; readonly mode: PaletteMode } | { readonly kind: "shortcuts" }

export interface LayerState {
  readonly layer: Layer | null
  readonly open: (next: Layer) => void
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
