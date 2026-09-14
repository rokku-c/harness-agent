import { expect, test } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSONUIProvider, Renderer } from "@json-render/react"
import { adaptRegistry } from "../adapt/registry.ts"
import { adaptComponent } from "../adapt/render.tsx"

test("a component the host supplies wins over the library's for its name", () => {
  let rendered = false
  const ours = { Text: () => { rendered = true; return React.createElement("span") } }
  const spec = { root: "root", elements: { root: { type: "Text", props: { value: "Injected" } } } }
  const registry = adaptRegistry(spec as never, adaptComponent, ours)
  renderToStaticMarkup(React.createElement(JSONUIProvider, { registry, children: React.createElement(Renderer, { spec: spec as never, registry }) }))
  expect(rendered).toBe(true)
})
