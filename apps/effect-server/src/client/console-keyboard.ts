/**
 * The console's keydown handling: §6.3's map, minus the keys that belong to a
 * list or a form and arrive with those.
 *
 * The order of the checks is the design, and each step is there because the step
 * before it would otherwise swallow it. The modifier chords come first, because
 * `Mod+K` must work with the caret in a filter — it is the one key the console
 * takes from a text field, and it takes it deliberately. Then the typing guard,
 * which is the whole of the safety rule. Then the `g` chord. Then the two single
 * keys, then the two arrows. `Escape` is not here at all: it answers to a
 * different question and is asked on the way down the tree (`console-escape.ts`).
 *
 * Only the keys the document binds are here, and each has a row in `KEY_MAP` — a
 * binding without a row is a key the sheet cannot mention, and the sheet is the
 * only reason anyone would find it.
 *
 * The action object is read through a ref and the listener is registered once,
 * because a keydown handler that is re-registered while the operator is holding a
 * key is a handler that misses the key.
 */

import * as React from "react"
import { CHORD_MS, CHORD_ROUTES } from "./console-chords.ts"
import { isBackKey, isForwardKey, isMod, isModShift, isTypingTarget } from "./console-key-press.ts"
import { readNow } from "./console-read-now.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { PaletteMode } from "./console-commands.ts"

export interface ConsoleKeys {
  /** Whether a palette is already open: `Mod+K` closes the one it opened. */
  readonly paletteOpen: boolean
  readonly openPalette: (mode: PaletteMode) => void
  readonly closePalette: () => void
  readonly openShortcuts: () => void
  /** A place, by the chord table. */
  readonly go: (route: ConsoleRoute) => void
  /** `g l`: the last app, at the screen it was left on. */
  readonly goLast: () => void
  /** One level up, by the history when this session walked here and by the address otherwise. */
  readonly back: () => void
  readonly forward: () => void
  readonly focusFilter: () => void
  readonly copyLink: () => void
}

export const useConsoleKeys = (keys: ConsoleKeys): void => {
  const latest = React.useRef(keys)
  React.useEffect(() => { latest.current = keys })
  React.useEffect(() => {
    /** When the `g` prefix was pressed, so its second key can arrive inside its window. */
    let chord = 0
    const onKeyDown = (event: KeyboardEvent): void => {
      const keys = latest.current
      // The modifier chords, before the typing guard: `Mod+K` is meant to work from
      // inside the field the operator is typing in.
      if (isMod(event) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (keys.paletteOpen) keys.closePalette(); else keys.openPalette("commands")
        return
      }
      if (isMod(event) && event.key.toLowerCase() === "p") {
        event.preventDefault()
        if (keys.paletteOpen) keys.closePalette(); else keys.openPalette("goto")
        return
      }
      if (isModShift(event, "c")) { event.preventDefault(); keys.copyLink(); return }
      if (isModShift(event, "r")) { event.preventDefault(); readNow(); return }
      // Every binding below is a bare key, so nothing here may fire under a modifier:
      // `Ctrl+R` is the browser's reload and `Ctrl+S` is the browser's save.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) { chord = 0; return }
      if (event.key === "g") { chord = Date.now(); return }
      const prefixed = chord !== 0 && Date.now() - chord <= CHORD_MS
      chord = 0
      // `l` is the sixth chord and not a route: it is the app you last left (console-goto.ts).
      if (prefixed && event.key === "l") { event.preventDefault(); keys.goLast(); return }
      const route = prefixed ? CHORD_ROUTES[event.key] : undefined
      if (route !== undefined) { event.preventDefault(); keys.go(route); return }
      if (event.key === "/") { event.preventDefault(); keys.focusFilter(); return }
      if (event.key === "?") { event.preventDefault(); keys.openShortcuts(); return }
      if (isBackKey(event)) { event.preventDefault(); keys.back(); return }
      if (isForwardKey(event)) { event.preventDefault(); keys.forward(); return }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
