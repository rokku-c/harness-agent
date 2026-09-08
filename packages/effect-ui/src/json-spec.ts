/**
 * EffectUiView -> @json-render Spec bridge.
 *
 * A view is a pure description. To render it client-side with a mature
 * renderer we map it onto a @json-render/core Spec (the same shape the repo's
 * ui-runtime produces and json-render/react Renderer consumes): elements
 * keyed by id, root children, props per component. Component names are the
 * built-in catalog (Text/Stack/Button/Input) that the client component
 * registry implements with responsive layouts.
 */

import type { Spec, UIElement } from "@json-render/core"
import type { EffectUiView, UiNodeSpec } from "./spec.ts"

type Elements = Record<string, UIElement>

const el = (type: string, props: Record<string, unknown>, children?: string[]): UIElement => ({
  type,
  props,
  ...(children !== undefined ? { children } : {}),
})

const lower = (node: UiNodeSpec, path: readonly number[], elements: Elements): string => {
  const id = node.id ?? path.join(".")
  switch (node.kind) {
    case "text":
      elements[id] = el("Text", { value: node.bind !== undefined ? { $bindState: node.bind } : node.text })
      return id
    case "stack": {
      const children = node.children.map((child, index) => lower(child, [...path, index], elements))
      const props: Record<string, unknown> = { direction: node.direction ?? "vertical" }
      if (node.gap !== undefined) props.gap = node.gap
      elements[id] = el("Stack", props, children)
      return id
    }
    case "button":
      elements[id] = el("Button", { label: node.bind !== undefined ? { $bindState: node.bind } : node.label })
      return id
    case "formField": {
      const props: Record<string, unknown> = { label: node.label }
      const value = node.bind !== undefined ? { $bindState: node.bind } : node.value
      if (value !== undefined) props.value = value
      if (node.placeholder !== undefined) props.placeholder = node.placeholder
      elements[id] = el("Input", props)
      return id
    }
    case "list": {
      const items = node.items.map((item, index) => {
        const itemId = `${id}.${index}`
        elements[itemId] = el("Text", { value: item })
        return itemId
      })
      elements[id] = el("Stack", { role: "list" }, items)
      return id
    }
  }
}

export const viewToJsonSpec = (view: EffectUiView): Spec => {
  const elements: Elements = {}
  const children = view.nodes.map((node, index) => lower(node, [index], elements))
  elements.root = el("Stack", { direction: "vertical" }, children)
  return { root: "root", elements }
}
