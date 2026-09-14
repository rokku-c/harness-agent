import type { Spec, UIElement } from "@json-render/core"
import type { EffectUiView, UiNode, UiViewLayout } from "./spec.ts"
import { actionParams, jsonBind, jsonRepeat, jsonVisible } from "./json-values.ts"

type Elements = Record<string, UIElement>

const content = (node: UiNode): Record<string, unknown> => {
  if (node.bind !== undefined) return { [node.as ?? "value"]: jsonBind(node.bind) }
  if (node.item !== undefined) return { [node.as ?? "value"]: { $item: node.item } }
  return {}
}

const lower = (node: UiNode, parent: string | undefined, index: number, elements: Elements): string => {
  const id = node.id ?? (parent === undefined ? String(index) : `${parent}.${index}`)
  const children = (node.children ?? []).map((child, childIndex) => lower(child, id, childIndex, elements))
  const element: UIElement = {
    type: node.component,
    props: { ...node.props, ...content(node) },
    ...(children.length === 0 ? {} : { children }),
    ...(node.onPress === undefined ? {} : {
      on: { press: { action: node.onPress, ...(node.params === undefined ? {} : { params: actionParams(node.params) }) } },
    }),
  }
  const repeat = jsonRepeat(node.repeat), visible = jsonVisible(node.visible)
  if (repeat !== undefined) element.repeat = repeat
  if (visible !== undefined) element.visible = visible
  elements[id] = element
  return id
}

const frame = (layout: UiViewLayout | undefined): Record<string, unknown> =>
  layout === "flow"
    ? { direction: "column", gap: "4", minHeight: "100%" }
    : { direction: "column", gap: "4", height: "100%", minHeight: "0", overflow: "auto" }

export const viewToJsonSpec = (view: EffectUiView): Spec => {
  const elements: Elements = {}
  const children = view.nodes.map((node, index) => lower(node, undefined, index, elements))
  elements.root = { type: "Flex", props: frame(view.layout), children }
  return { root: "root", elements, ...(view.state === undefined ? {} : { state: view.state }) }
}

export const nodesToSpec = (nodes: readonly UiNode[]): Spec => viewToJsonSpec({ viewId: "document", nodes })
