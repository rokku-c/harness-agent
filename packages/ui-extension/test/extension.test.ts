import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { makeExtensionRegistry } from "../src/index.ts"

test("enables an extension and registers its components", () => {
  const definitions = makeDefinitionStore()
  const registry = makeExtensionRegistry(definitions)
  registry.enable({ manifest: { name: "charts", version: "1", permissions: ["render"], components: ["Chart"] }, components: [{ type: "Chart", version: "1", category: "extension" }] })
  expect(definitions.getComponent("Chart")?.category).toBe("extension")
  expect(registry.list()[0]?.name).toBe("charts")
  registry.disable("charts")
  expect(registry.list()).toEqual([])
  expect(definitions.getComponent("Chart")).toBeUndefined()
})

test("restores an overridden component on disable", () => {
  const definitions = makeDefinitionStore()
  definitions.registerComponent({ type: "Text", version: "base", category: "base" })
  const registry = makeExtensionRegistry(definitions)
  registry.enable({ manifest: { name: "override", version: "1", permissions: ["render"] }, components: [{ type: "Text", version: "ext", category: "extension" }] })
  registry.disable("override")
  expect(definitions.getComponent("Text")?.version).toBe("base")
})

test("does not clobber a newer override", () => {
  const definitions = makeDefinitionStore()
  const registry = makeExtensionRegistry(definitions)
  registry.enable({ manifest: { name: "a", version: "1", permissions: ["render"] }, components: [{ type: "Card", version: "a", category: "extension" }] })
  registry.enable({ manifest: { name: "b", version: "1", permissions: ["render"] }, components: [{ type: "Card", version: "b", category: "extension" }] })
  registry.disable("a")
  expect(definitions.getComponent("Card")?.version).toBe("b")
})

test("requires render permission for component extensions", () => {
  const registry = makeExtensionRegistry(makeDefinitionStore())
  expect(() => registry.enable({ manifest: { name: "bad", version: "1", permissions: [] }, components: [{ type: "X", version: "1", category: "extension" }] })).toThrow("render permission")
})
