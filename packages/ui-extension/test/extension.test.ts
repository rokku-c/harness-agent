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
})
