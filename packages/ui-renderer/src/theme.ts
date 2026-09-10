export type ThemeTokens = Readonly<Record<string, string | number>>

export interface ThemeDefinition {
  readonly id: string
  readonly tokens: ThemeTokens
}

export interface ThemeRegistry {
  register(theme: ThemeDefinition): void
  get(id: string): ThemeDefinition | undefined
  list(): ReadonlyArray<string>
}

export const makeThemeRegistry = (initial: ReadonlyArray<ThemeDefinition> = []): ThemeRegistry => {
  const themes = new Map(initial.map((theme) => [theme.id, theme]))
  return {
    register: (theme) => themes.set(theme.id, theme),
    get: (id) => themes.get(id),
    list: () => [...themes.keys()]
  }
}

export const defaultThemes: ReadonlyArray<ThemeDefinition> = [
  {
    id: "default",
    tokens: {
      "color-text": "#111827",
      "color-surface": "#ffffff",
      bg: "#F2F2F7",
      surface: "#FFFFFF",
      "surface-2": "#F8F8FA",
      "surface-3": "rgba(0,0,0,.045)",
      ink: "#1C1C1E",
      muted: "#6C6C70",
      faint: "#8E8E93",
      line: "#E5E5EA",
      "line-soft": "#F0F0F3",
      accent: "#178A5C",
      "accent-ink": "#FFFFFF",
      "accent-soft": "rgba(23,138,92,.13)",
      focus: "#178A5C",
      field: "#FAFAFC",
      "field-line": "#D9D9DE"
    }
  },
  {
    id: "dark",
    tokens: {
      "color-text": "#f9fafb",
      "color-surface": "#111827",
      bg: "#000000",
      surface: "#1C1C1E",
      "surface-2": "#26262A",
      "surface-3": "rgba(255,255,255,.06)",
      ink: "#F2F2F7",
      muted: "rgba(235,235,245,.62)",
      faint: "rgba(235,235,245,.42)",
      line: "#38383A",
      "line-soft": "#2C2C2E",
      accent: "#33C48F",
      "accent-ink": "#002516",
      "accent-soft": "rgba(51,196,143,.16)",
      focus: "#4AD3A0",
      field: "#1C1C1E",
      "field-line": "#3A3A3C"
    }
  }
]
