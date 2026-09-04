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
