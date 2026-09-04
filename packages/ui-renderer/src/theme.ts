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
  { id: "default", tokens: { "color-text": "#111827", "color-surface": "#ffffff" } },
  { id: "dark", tokens: { "color-text": "#f9fafb", "color-surface": "#111827" } }
]
