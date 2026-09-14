/**
 * Following the console's appearance, not owning one.
 *
 * The document element holds the mode — that is where a browser paints from and
 * where the persisted choice lands — so this reads it and re-reads it when it
 * changes, rather than keeping a second copy. "System" is a decision the
 * document element does not make, so it is resolved here against the media query.
 */

import * as React from "react"
import { normalizeThemeMode, setThemeMode, THEME_CHANGE, type ThemeMode } from "./theme-runtime.ts"

const prefersDark = (): boolean => window.matchMedia?.("(prefers-color-scheme: dark)").matches === true

const currentMode = (): ThemeMode => normalizeThemeMode(document.documentElement.dataset.themeMode)

/** The current mode, and the one way to set it: document, store and UI move together. */
export const useThemeMode = (): readonly [ThemeMode, (mode: ThemeMode) => void] => {
  const [mode, setMode] = React.useState(currentMode)
  React.useEffect(() => {
    const onMode = () => setMode(currentMode())
    window.addEventListener(THEME_CHANGE, onMode)
    return () => window.removeEventListener(THEME_CHANGE, onMode)
  }, [])
  const set = React.useCallback((next: ThemeMode) => {
    let storage: Storage | undefined
    try { storage = window.localStorage } catch {}
    setThemeMode(next, storage)
  }, [])
  return [mode, set]
}

export const appearanceOf = (mode: ThemeMode, dark: boolean): "light" | "dark" =>
  mode === "system" ? (dark ? "dark" : "light") : mode

export const useAppearance = (): "light" | "dark" => {
  const [mode] = useThemeMode()
  const [dark, setDark] = React.useState(prefersDark)
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onMedia = () => setDark(media.matches)
    media.addEventListener("change", onMedia)
    return () => media.removeEventListener("change", onMedia)
  }, [])
  return appearanceOf(mode, dark)
}
