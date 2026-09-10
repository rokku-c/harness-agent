import { consoleThemeDark, consoleThemeLight, type ConsoleThemeTokens } from "./theme-palette.ts"
export type { ConsoleThemeTokens } from "./theme-palette.ts"
export { consoleThemeDark, consoleThemeLight } from "./theme-palette.ts"
const cssVars = (tokens: ConsoleThemeTokens): string => Object.entries(tokens).map(([name, value]) => `--${name}:${value}`).join(";")
export const consoleThemeCss = (): string => [
  `:root{color-scheme:light;${cssVars(consoleThemeLight)}}`,
  `:root[data-theme="light"]{color-scheme:light;${cssVars(consoleThemeLight)}}`,
  `:root[data-theme="dark"]{color-scheme:dark;${cssVars(consoleThemeDark)}}`,
  `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;${cssVars(consoleThemeDark)}}}`,
].join("\n")
export const resolveConsoleTokens = (theme: string | undefined): ConsoleThemeTokens => theme === "dark" ? consoleThemeDark : consoleThemeLight
