export type ThemeMode = "system" | "light" | "dark"
const modes: ThemeMode[] = ["system", "light", "dark"]
export const normalizeThemeMode = (value: string | null | undefined): ThemeMode => value === "light" || value === "dark" ? value : "system"
export const nextThemeMode = (mode: ThemeMode): ThemeMode => modes[(modes.indexOf(mode) + 1) % modes.length]
export const themeLabel = (mode: ThemeMode): string => mode === "system" ? "Follow system" : mode === "light" ? "Light mode" : "Dark mode"
const read = (storage: Storage | undefined): ThemeMode => { try { return normalizeThemeMode(storage?.getItem("effect-theme")) } catch { return "system" } }
const save = (storage: Storage | undefined, mode: ThemeMode) => { try { storage?.setItem("effect-theme", mode) } catch {} }
export const applyThemeMode = (root: HTMLElement, mode: ThemeMode): void => { root.dataset.themeMode = mode; if (mode === "system") root.removeAttribute("data-theme"); else root.dataset.theme = mode }
export const installThemeRuntime = (root: HTMLElement, button: HTMLButtonElement | null, storage?: Storage): ThemeMode => {
  let mode = read(storage); const update = () => { applyThemeMode(root, mode); if (button) { button.title = themeLabel(mode); button.setAttribute("aria-label", `Appearance: ${themeLabel(mode)}`) } }
  update(); if (button) button.onclick = () => { mode = nextThemeMode(mode); save(storage, mode); update() }; return mode
}
