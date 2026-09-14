export type ThemeMode = "system" | "light" | "dark"
export const THEME_CHANGE = "effect-theme-change"
export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"]
export const normalizeThemeMode = (value: string | null | undefined): ThemeMode => value === "light" || value === "dark" ? value : "system"
export const nextThemeMode = (mode: ThemeMode): ThemeMode => THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length]
export const themeLabel = (mode: ThemeMode): string => mode === "system" ? "Follow system" : mode === "light" ? "Light mode" : "Dark mode"
export const readThemeMode = (storage: Storage | undefined): ThemeMode => { try { return normalizeThemeMode(storage?.getItem("effect-theme")) } catch { return "system" } }
export const applyThemeMode = (mode: ThemeMode): void => { document.documentElement.dataset.themeMode = mode }
export const notifyThemeMode = (mode: ThemeMode): void => { window.dispatchEvent(new CustomEvent(THEME_CHANGE, { detail: mode })) }
export const setThemeMode = (mode: ThemeMode, storage?: Storage): void => {
  applyThemeMode(mode)
  notifyThemeMode(mode)
  try { storage?.setItem("effect-theme", mode) } catch {}
}
export const bootThemeMode = (storage?: Storage): ThemeMode => {
  const mode = readThemeMode(storage)
  applyThemeMode(mode)
  return mode
}
