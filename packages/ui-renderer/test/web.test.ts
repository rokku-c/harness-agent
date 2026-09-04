import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { resolveCanvas } from "@effect-agent/ui-runtime"
import { webRenderer } from "../src/index.ts"

test("web renderer renders resolved definition", () => {
  const store = makeDefinitionStore()
  store.apply({ kind: "create-canvas", canvasId: "root", title: "Home" })
  store.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text", bindings: { value: { kind: "path", value: "$.message" } } } })
  const html = webRenderer.render(resolveCanvas(store, "root", { message: "Hello <world>" }))
  expect(html).toContain("Hello &lt;world&gt;")
  expect(html).toContain('data-canvas="root"')
  expect(webRenderer.render(resolveCanvas(store, "root"), { theme: "dark" })).toContain('data-theme="dark"')
})
