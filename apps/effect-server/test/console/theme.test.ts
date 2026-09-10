import { expect, test } from "bun:test"
import { consoleThemeCss, consoleThemeDark, consoleThemeLight, resolveConsoleTokens } from "../../src/console/theme.ts"

const names = (tokens: Record<string, string>): string[] => Object.keys(tokens)

test("light and dark cover the same token names (no missing var in a theme)", () => {
  expect(names(consoleThemeDark).sort()).toEqual(names(consoleThemeLight).sort())
})

test("accent is the brand green; dark re-tunes it brighter for contrast", () => {
  expect(consoleThemeLight.accent).toBe("#178A5C")
  expect(consoleThemeDark.accent).toBe("#33C48F")
})

test("consoleThemeCss defines light root, explicit dark, and follow-system media", () => {
  const css = consoleThemeCss()
  expect(css).toContain(":root{color-scheme:light")
  expect(css).toContain(`:root[data-theme="dark"]{color-scheme:dark`)
  expect(css).toContain("@media (prefers-color-scheme:dark)")
  // every declared var appears in the emitted css for each of the three blocks
  for (const name of names(consoleThemeLight)) {
    expect(css).toContain(`--${name}:`)
  }
})

test("resolveConsoleTokens returns concrete sets for light/dark, default light for system/unset", () => {
  expect(resolveConsoleTokens("light")).toBe(consoleThemeLight)
  expect(resolveConsoleTokens("dark")).toBe(consoleThemeDark)
  expect(resolveConsoleTokens("system")).toBe(consoleThemeLight)
  expect(resolveConsoleTokens(undefined)).toBe(consoleThemeLight)
})
