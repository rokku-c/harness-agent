import type { ActionBinding, Spec, UIElement } from "@json-render/core"
import type { ActionRef, BindingExpression, CanvasDefinition, UINode } from "@effect-agent/ui-protocol"

const pointer = (path: string): string => "/" + path.replace(/^\$\.?/, "").split(".").filter(Boolean).join("/")
const binding = (value: BindingExpression): unknown => value.kind === "path" ? { $state: pointer(value.value) } : value.value
const action = (value: ActionRef): ActionBinding => ({ action: value.action, params: value.input })

const element = (node: UINode): UIElement => {
  const props: Record<string, unknown> = { ...(node.props ?? {}) }
  for (const [key, value] of Object.entries(node.bindings ?? {})) props[key] = binding(value)
  const on = Object.fromEntries(Object.entries(node.events ?? {}).map(([name, values]) => [name, values.map(action)]))
  return {
    type: node.type,
    props,
    children: node.children === undefined ? undefined : [...node.children],
    slots: node.slots === undefined ? undefined : Object.fromEntries(Object.entries(node.slots).map(([key, ids]) => [key, [...ids]])),
    on: Object.keys(on).length === 0 ? undefined : on
  }
}

export const toJsonRenderSpec = (canvas: CanvasDefinition): Spec => {
  const root = `canvas:${canvas.canvasId}`
  const elements: Record<string, UIElement> = {
    [root]: { type: "Stack", props: { canvasId: canvas.canvasId, title: canvas.title }, children: [...canvas.rootNodeIds] }
  }
  for (const [id, node] of Object.entries(canvas.nodes)) elements[id] = element(node)
  return { root, elements }
}
