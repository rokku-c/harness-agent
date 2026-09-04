import type { ResolvedNode, ResolvedUITree } from "@effect-agent/ui-runtime"

export interface RendererContext { readonly onAction?: (action: string) => string; readonly theme?: string }
export interface Renderer {
  readonly id: string
  render(tree: ResolvedUITree, context?: RendererContext): string
}
export interface RendererRegistry { register(renderer: Renderer): void; get(id: string): Renderer | undefined; list(): ReadonlyArray<string> }
export const makeRendererRegistry = (initial: ReadonlyArray<Renderer> = []): RendererRegistry => {
  const renderers = new Map(initial.map((renderer) => [renderer.id, renderer]))
  return {
    register: (renderer) => { renderers.set(renderer.id, renderer) },
    get: (id) => renderers.get(id),
    list: () => [...renderers.keys()]
  }
}

const escape = (value: unknown): string => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!)
const attrs = (props: Record<string, unknown>): string => Object.entries(props).filter(([key]) => key !== "targetCanvasId").map(([key, value]) => ` data-${key}="${escape(value)}"`).join("")
const renderNode = (node: ResolvedNode, context: RendererContext): string => {
  const children = node.resolvedChildren.map((child) => renderNode(child, context)).join("")
  const action = node.events?.click?.[0]?.action
  const click = action === undefined ? "" : ` data-action="${escape(context.onAction?.(action) ?? action)}"`
  if (node.type === "Text") return `<span${attrs(node.resolvedProps)}${click}>${escape(node.resolvedProps.value)}</span>`
  if (node.type === "Button") return `<button${attrs(node.resolvedProps)}${click}>${escape(node.resolvedProps.label ?? node.resolvedProps.value)}</button>`
  if (node.type === "CanvasRef") return `<section data-canvas-ref="${escape(node.resolvedProps.targetCanvasId)}"${click}>${children}</section>`
  return `<div data-component="${escape(node.type)}"${attrs(node.resolvedProps)}${click}>${children}</div>`
}

export const webRenderer: Renderer = {
  id: "web-html",
  render: (tree, context = {}) => `<main data-canvas="${escape(tree.canvasId)}" data-version="${tree.version}" data-theme="${escape(context.theme ?? "default")}"><h1>${escape(tree.title)}</h1>${tree.children.map((node) => renderNode(node, context)).join("")}</main>`
}
