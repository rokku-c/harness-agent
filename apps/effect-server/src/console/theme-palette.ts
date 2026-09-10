export interface ConsoleThemeTokens { readonly [name: string]: string }
export const consoleThemeLight: ConsoleThemeTokens = {
  bg: "#F2F2F7", surface: "#FFFFFF", "surface-2": "#F8F8FA", "surface-3": "rgba(0,0,0,.045)",
  ink: "#1C1C1E", muted: "#6C6C70", faint: "#8E8E93", line: "#E5E5EA", "line-soft": "#F0F0F3",
  accent: "#178A5C", "accent-ink": "#FFFFFF", "accent-soft": "rgba(23,138,92,.13)", focus: "#178A5C",
  field: "#FAFAFC", "field-line": "#D9D9DE", "chip-bg": "#EEF1ED", "chip-ink": "#5F6D62", "chip-line": "#DCE2DA",
  "ok-bg": "#E8F6EF", "ok-ink": "#2E6B4C", "ok-line": "#C9E8D5", "warn-bg": "#FFF6E0", "warn-ink": "#7A5A12", "warn-line": "#EFDDB0",
  "danger-bg": "#FFF1EF", "danger-ink": "#AD382F", "danger-line": "#F0C9C1", "block-bg": "#F6F8F6", "block-line": "#E7EDE7", shadow: "rgba(0,0,0,.08)", "shadow-strong": "rgba(0,0,0,.14)",
}
export const consoleThemeDark: ConsoleThemeTokens = {
  bg: "#000000", surface: "#1C1C1E", "surface-2": "#26262A", "surface-3": "rgba(255,255,255,.06)", ink: "#F2F2F7", muted: "rgba(235,235,245,.62)", faint: "rgba(235,235,245,.42)", line: "#38383A", "line-soft": "#2C2C2E",
  accent: "#33C48F", "accent-ink": "#002516", "accent-soft": "rgba(51,196,143,.16)", focus: "#4AD3A0", field: "#1C1C1E", "field-line": "#3A3A3C", "chip-bg": "#23262A", "chip-ink": "#AEB8B2", "chip-line": "#363B3F",
  "ok-bg": "#143526", "ok-ink": "#7AD8A9", "ok-line": "#1F4A36", "warn-bg": "#33290F", "warn-ink": "#E4C877", "warn-line": "#4A3A15", "danger-bg": "#3A1714", "danger-ink": "#F0A196", "danger-line": "#5A2320", "block-bg": "#22242A", "block-line": "#33363C", shadow: "rgba(0,0,0,.5)", "shadow-strong": "rgba(0,0,0,.6)",
}
