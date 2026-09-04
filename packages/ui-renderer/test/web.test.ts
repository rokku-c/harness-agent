import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { resolveCanvas } from "@effect-agent/ui-runtime"
import { webRenderer, makeRendererRegistry, renderRuntime, makeThemeRegistry } from "../src/index.ts"
import { makeUIRuntime } from "@effect-agent/ui-runtime"

test("web renderer renders resolved definition", () => {
  const store = makeDefinitionStore()
  store.apply({ kind: "create-canvas", canvasId: "root", title: "Home" })
  store.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text", bindings: { value: { kind: "path", value: "$.message" } } } })
  const html = webRenderer.render(resolveCanvas(store, "root", { message: "Hello <world>" }))
  expect(html).toContain("Hello &lt;world&gt;")
  expect(html).toContain('data-canvas="root"')
  expect(webRenderer.render(resolveCanvas(store, "root"), { theme: "dark" })).toContain('data-theme="dark"')
})

test("renders the runtime's active theme", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Home" })
  runtime.setTheme("contrast")
  const html = renderRuntime(makeRendererRegistry([webRenderer]), runtime)
  expect(html).toContain('data-theme="contrast"')
})

test("passes declarative theme tokens to the renderer", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "set-theme", theme: "dark" })
  const themes = makeThemeRegistry([{ id: "dark", tokens: { "color-text": "#fff" } }])
  const html = renderRuntime(makeRendererRegistry([webRenderer]), runtime, undefined, themes)
  expect(html).toContain("--color-text:#fff")
})

test("ignores unsafe dynamic attribute names", () => {
  const store = makeDefinitionStore()
  store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  store.apply({ kind: "insert-node", canvasId: "root", node: {
    id: "x", type: "Box", props: { 'x" onmouseover="bad': "ignored", "data-ok": "yes" }
  } })
  const html = webRenderer.render(resolveCanvas(store, "root"))
  expect(html).not.toContain("onmouseover")
  expect(html).toContain("data-data-ok=\"yes\"")
})
