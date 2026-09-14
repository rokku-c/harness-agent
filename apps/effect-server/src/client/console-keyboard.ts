import * as React from "react"
import { CHORD_MS, CHORD_ROUTES } from "./console-chords.ts"
import { isBackKey, isForwardKey, isMod, isModShift, isTypingTarget } from "./console-key-press.ts"
import { readNow } from "./console-read-now.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { PaletteMode } from "./console-commands.ts"

export interface ConsoleKeys {
  readonly paletteOpen: boolean
  readonly openPalette: (mode: PaletteMode) => void
  readonly closePalette: () => void
  readonly openShortcuts: () => void
  readonly go: (route: ConsoleRoute) => void
  readonly goLast: () => void
  readonly back: () => void
  readonly forward: () => void
  readonly focusFilter: () => void
  readonly copyLink: () => void
}

export const useConsoleKeys = (keys: ConsoleKeys): void => {
  const latest = React.useRef(keys)
  React.useEffect(() => { latest.current = keys })
  React.useEffect(() => {
    let chord = 0
    const onKeyDown = (event: KeyboardEvent): void => {
      const keys = latest.current
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
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) { chord = 0; return }
      if (event.key === "g") { chord = Date.now(); return }
      const prefixed = chord !== 0 && Date.now() - chord <= CHORD_MS
      chord = 0
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
