import { expect, test } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSONUIProvider, Renderer } from "@json-render/react"
import { makeEffectUiRegistry } from "../effect-ui-catalog.tsx"

test("catalog registry accepts injected component renderers", () => {
  let rendered = false
  const registry = makeEffectUiRegistry({ Text: () => { rendered = true; return React.createElement("span") } })
  const spec = { root: "root", elements: { root: { type: "Text", props: { value: "Injected" } } } }
  renderToStaticMarkup(React.createElement(JSONUIProvider, { registry, children: React.createElement(Renderer, { spec, registry }) }))
  expect(rendered).toBe(true)
})
