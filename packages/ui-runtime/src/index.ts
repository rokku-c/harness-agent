import type { BindingExpression, CanvasDefinition, UINode } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"
export { makeActions, type NavigationState, type RuntimeActions } from "./actions.ts"
export { makeUIRuntime, type UIRuntime, type UIRuntimeOptions } from "./runtime.ts"
export { makeUIJournal, type UIJournal } from "./journal.ts"

export interface RuntimeContext { readonly state: Record<string, unknown>; readonly canvasId: string }
export interface ResolvedNode extends UINode { readonly resolvedProps: Record<string, unknown>; readonly resolvedChildren: ReadonlyArray<ResolvedNode> }
export interface ResolvedUITree { readonly canvasId: string; readonly title: string; readonly children: ReadonlyArray<ResolvedNode>; readonly version: number }

const lookup = (state: unknown, path: string): unknown => {
  const parts = path.replace(/^\$/, "").split(".").filter(Boolean)
  let value: unknown = state
  for (const part of parts) {
    if (typeof value !== "object" || value === null) return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

export const resolveBinding = (expression: BindingExpression, context: RuntimeContext): unknown => {
  if (expression.kind === "path") return lookup(context.state, expression.value)
  if (expression.kind === "template") return expression.value.replace(/\{\{\s*([^{}]+?)\s*\}\}|\$[\w.]+/g, (token, inner) => String(lookup(context.state, inner ?? token) ?? ""))
  return lookup(context.state, expression.value)
}

const resolveNode = (canvas: CanvasDefinition, node: UINode, context: RuntimeContext, all: DefinitionStore): ResolvedNode => {
  const resolvedProps: Record<string, unknown> = { ...(node.props ?? {}) }
  for (const [key, binding] of Object.entries(node.bindings ?? {})) resolvedProps[key] = resolveBinding(binding, context)
  const children = (node.children ?? []).map((id) => canvas.nodes[id]).filter((child): child is UINode => child !== undefined)
    .map((child) => resolveNode(canvas, child, context, all))
  const definition = all.getComponent(node.type)
  if (definition?.template !== undefined) {
    const template = { ...definition.template, id: node.id + ":template", props: { ...definition.template.props, ...node.props } }
    const scoped = { ...context, state: { ...context.state, props: node.props ?? {} } }
    if (template.slot !== undefined) {
      const injected = node.slots?.[template.slot] ?? node.children ?? []
      for (const id of injected) {
        const child = canvas.nodes[id]
        if (child !== undefined) children.push(resolveNode(canvas, child, scoped, all))
      }
    } else children.push(resolveNode(canvas, template, scoped, all))
  }
  const target = typeof node.props?.targetCanvasId === "string" ? all.getCanvas(node.props.targetCanvasId) : undefined
  if (target !== undefined) for (const id of target.rootNodeIds) {
    const child = target.nodes[id]
    if (child !== undefined) children.push(resolveNode(target, child, { ...context, canvasId: target.canvasId }, all))
  }
  return { ...node, resolvedProps, resolvedChildren: children }
}

export const resolveCanvas = (store: DefinitionStore, canvasId: string, state: Record<string, unknown> = {}): ResolvedUITree => {
  const canvas = store.getCanvas(canvasId)
  if (canvas === undefined) throw new Error("canvas not found: " + canvasId)
  const context = { state, canvasId }
  const children = canvas.rootNodeIds.map((id) => canvas.nodes[id]).filter((node): node is UINode => node !== undefined).map((node) => resolveNode(canvas, node, context, store))
  return { canvasId, title: canvas.title, children, version: canvas.version }
}
