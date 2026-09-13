export type ThemeMode = "system" | "light" | "dark"
/** Raised on the window whenever the document element's mode changes. */
export const THEME_CHANGE = "effect-theme-change"
const modes: ThemeMode[] = ["system", "light", "dark"]
export const normalizeThemeMode = (value: string | null | undefined): ThemeMode => value === "light" || value === "dark" ? value : "system"
export const nextThemeMode = (mode: ThemeMode): ThemeMode => modes[(modes.indexOf(mode) + 1) % modes.length]
export const themeLabel = (mode: ThemeMode): string => mode === "system" ? "Follow system" : mode === "light" ? "Light mode" : "Dark mode"
export const readThemeMode = (storage: Storage | undefined): ThemeMode => { try { return normalizeThemeMode(storage?.getItem("effect-theme")) } catch { return "system" } }
/** The document element carries the mode; the design system reads it from there. */
export const applyThemeMode = (mode: ThemeMode): void => { document.documentElement.dataset.themeMode = mode }
/** Raised on the window so anything rendering itself re-reads the mode it just changed. */
export const notifyThemeMode = (mode: ThemeMode): void => { window.dispatchEvent(new CustomEvent(THEME_CHANGE, { detail: mode })) }
/** One place writes the mode, so the document, the store and the UI cannot disagree. */
export const setThemeMode = (mode: ThemeMode, storage?: Storage): void => {
  applyThemeMode(mode)
  notifyThemeMode(mode)
  try { storage?.setItem("effect-theme", mode) } catch {}
}
/** Applies the stored choice once at boot, so a reload keeps the reader's appearance. */
export const bootThemeMode = (storage?: Storage): ThemeMode => {
  const mode = readThemeMode(storage)
  applyThemeMode(mode)
  return mode
}
