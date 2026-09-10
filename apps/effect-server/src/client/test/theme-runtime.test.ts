import { expect, test } from "bun:test"
import { nextThemeMode, normalizeThemeMode, themeLabel } from "../theme-runtime.ts"

test("theme mode cycles and invalid persisted values reset safely", () => {
  expect([nextThemeMode("system"), nextThemeMode("light"), nextThemeMode("dark")]).toEqual(["light", "dark", "system"])
  expect(normalizeThemeMode("sepia")).toBe("system")
  expect(themeLabel("dark")).toBe("Dark mode")
})
