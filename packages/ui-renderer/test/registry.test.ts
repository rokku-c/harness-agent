import { expect, test } from "bun:test"
import { makeRendererRegistry, webRenderer, type Renderer } from "../src/index.ts"

test("accepts replaceable renderer implementations", () => {
  const custom: Renderer = { id: "custom", render: (tree) => "custom:" + tree.canvasId }
  const registry = makeRendererRegistry([webRenderer])
  registry.register(custom)
  expect(registry.list()).toEqual(["web-html", "custom"])
  expect(registry.get("custom")?.id).toBe("custom")
})
