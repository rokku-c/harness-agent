/**
 * The console's own keydown handling: four bindings, one chord, one guard.
 *
 * The guard comes first and is the whole of the safety rule — while a text
 * field, textarea, select or slider has focus, nothing here runs at all. The
 * four bindings are the ones `design-system.md` §10.3 gives the shell, and
 * `console-keys.ts` holds the table they are half of: the sheet is generated
 * from that table, so what is bound and what is printed cannot drift.
 *
 * `Escape` is not among them. Every layer the console opens is Radix's, Radix
 * closes the topmost one itself and restores the focus that opened it, and with
 * no layer open it does nothing — so binding it here would be the second
 * opinion that turns "never navigates" into "sometimes navigates".
 *
 * The action object is read through a ref and the listener is registered once,
 * because a keydown handler that is re-registered while the operator is holding
 * a key is a handler that misses the key.
 */

import * as React from "react"
import { CHORD_MS, isMod, isTypingTarget } from "./console-keys.ts"
import { readNow } from "./console-read-now.ts"

export interface ConsoleKeys {
  /** Whether a palette is already open: `Mod+K` closes the one it opened. */
  readonly paletteOpen: boolean
  readonly openPalette: () => void
  readonly openShortcuts: () => void
  readonly closePalette: () => void
  readonly goHome: () => void
  readonly goSettings: () => void
}

export const useConsoleKeys = (keys: ConsoleKeys): void => {
  const latest = React.useRef(keys)
  React.useEffect(() => { latest.current = keys })
  React.useEffect(() => {
    /** When the `g` prefix was pressed, so its second key can arrive inside its window. */
    let chord = 0
    const onKeyDown = (event: KeyboardEvent): void => {
      const keys = latest.current
      if (isMod(event) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (keys.paletteOpen) keys.closePalette(); else keys.openPalette()
        return
      }
      // Every binding below is a bare key, so nothing here may fire under a modifier:
      // `Ctrl+R` is the browser's reload and `Ctrl+S` is the browser's save.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) { chord = 0; return }
      const prefixed = chord !== 0 && Date.now() - chord <= CHORD_MS
      chord = 0
      switch (event.key) {
        case "h": if (prefixed) { event.preventDefault(); keys.goHome() } return
        case "s": if (prefixed) { event.preventDefault(); keys.goSettings() } return
        case "g": chord = Date.now(); return
        case "?": event.preventDefault(); keys.openShortcuts(); return
        case "r": event.preventDefault(); readNow(); return
        default: return
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
