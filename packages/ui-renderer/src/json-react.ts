import { createElement, Fragment, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { defineCatalog, type Spec, type UIElement } from "@json-render/core"
import { createRenderer, type ComponentRenderProps } from "@json-render/react"
import { schema } from "@json-render/react/schema"
import { z } from "zod"
import type { ResolvedNode, ResolvedUITree } from "@effect-agent/ui-runtime"
import type { Renderer } from "./index.ts"

const props = z.object({}).loose()
const catalog = defineCatalog(schema, { components: {
  Stack: { props, description: "Canvas or layout container", slots: ["default"] },
  Text: { props, description: "Text content", slots: [] },
  Button: { props, description: "Interactive button", slots: [] },
  Input: { props, description: "Text input", slots: [] },
  CanvasRef: { props, description: "Link to another canvas", slots: ["default"] },
  Slot: { props, description: "Composite component slot", slots: ["default"] }
}, actions: {} })

const p = (value: ComponentRenderProps) => value.element.props as Record<string, unknown>
const JsonRenderer = createRenderer(catalog, {
  Stack: ({ children }) => createElement("div", { "data-component": "Stack" }, children),
  Text: (value) => createElement("span", null, String(p(value).value ?? "")),
  Button: (value) => createElement("button", null, String(p(value).label ?? p(value).value ?? "")),
  Input: (value) => createElement("input", { value: String(p(value).value ?? ""), readOnly: true }),
  CanvasRef: (value) => createElement("section", { "data-canvas-ref": p(value).targetCanvasId }, value.children),
  Slot: ({ children }) => createElement(Fragment, null, children as ReactNode)
})

const flatten = (nodes: ReadonlyArray<ResolvedNode>, elements: Record<string, UIElement>, prefix = ""): string[] => nodes.map((node) => {
  const key = prefix + node.id
  const children = flatten(node.resolvedChildren, elements, key + "/")
  elements[key] = { type: node.type, props: node.resolvedProps, children }
  return key
})

const spec = (tree: ResolvedUITree): Spec => {
  const elements: Record<string, UIElement> = {}
  const children = flatten(tree.children, elements)
  elements.root = { type: "Stack", props: { canvasId: tree.canvasId, title: tree.title }, children }
  return { root: "root", elements }
}

export const jsonReactRenderer: Renderer = {
  id: "json-render-react",
  render: (tree) => renderToStaticMarkup(createElement(JsonRenderer, { spec: spec(tree) }))
}
