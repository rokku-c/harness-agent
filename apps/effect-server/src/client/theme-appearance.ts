import * as React from "react"
import { normalizeThemeMode, setThemeMode, THEME_CHANGE, type ThemeMode } from "./theme-runtime.ts"

const prefersDark = (): boolean => window.matchMedia?.("(prefers-color-scheme: dark)").matches === true

const currentMode = (): ThemeMode => normalizeThemeMode(document.documentElement.dataset.themeMode)

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
