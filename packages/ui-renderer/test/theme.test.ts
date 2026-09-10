import { expect, test } from "bun:test"
import { defaultThemes, makeThemeRegistry } from "../src/index.ts"

test("registers replaceable declarative themes", () => {
  const registry = makeThemeRegistry(defaultThemes)
  registry.register({ id: "brand", tokens: { "color-text": "#123456" } })
  expect(registry.list()).toEqual(["default", "dark", "brand"])
  expect(registry.get("brand")?.tokens["color-text"]).toBe("#123456")
})

test("replaces a theme without changing its registry position", () => {
  const registry = makeThemeRegistry(defaultThemes)
  registry.register({ id: "dark", tokens: { "color-text": "#000" } })
  expect(registry.list()).toEqual(["default", "dark"])
  expect(registry.get("dark")?.tokens["color-text"]).toBe("#000")
})

test("default theme carries console semantic tokens (light) and legacy color keys", () => {
  const tokens = defaultThemes.find((t) => t.id === "default")!.tokens
  expect(tokens.bg).toBe("#F2F2F7")
  expect(tokens.surface).toBe("#FFFFFF")
  expect(tokens.ink).toBe("#1C1C1E")
  expect(tokens.muted).toBe("#6C6C70")
  expect(tokens.line).toBe("#E5E5EA")
  expect(tokens["surface-2"]).toBe("#F8F8FA")
  expect(tokens["accent-soft"]).toBe("rgba(23,138,92,.13)")
  expect(tokens.accent).toBe("#178A5C")
  expect(tokens["accent-ink"]).toBe("#FFFFFF")
  expect(tokens["color-text"]).toBe("#111827")
  expect(tokens["color-surface"]).toBe("#ffffff")
})

test("dark theme carries console semantic tokens (dark) and legacy color keys", () => {
  const tokens = defaultThemes.find((t) => t.id === "dark")!.tokens
  expect(tokens.bg).toBe("#000000")
  expect(tokens.surface).toBe("#1C1C1E")
  expect(tokens.ink).toBe("#F2F2F7")
  expect(tokens.muted).toBe("rgba(235,235,245,.62)")
  expect(tokens.line).toBe("#38383A")
  expect(tokens["surface-2"]).toBe("#26262A")
  expect(tokens["accent-soft"]).toBe("rgba(51,196,143,.16)")
  expect(tokens.accent).toBe("#33C48F")
  expect(tokens["accent-ink"]).toBe("#002516")
  expect(tokens["color-text"]).toBe("#f9fafb")
  expect(tokens["color-surface"]).toBe("#111827")
})
