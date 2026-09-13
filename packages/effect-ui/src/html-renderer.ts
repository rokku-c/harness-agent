/**
 * effect-ui "html" renderer — a self-contained declarative renderer.
 *
 * Owns its own HTML conventions (data-effect-ui, data-node, data-component).
 * It depends only on the effect-ui spec types, so it is fully decoupled from
 * the repo's ui-* renderer world (the seam's "portable" side).
 *
 * It has no components of its own: a node names a design-system component this
 * renderer has never heard of, so it emits the name as data and the props as
 * data attributes. A stylesheet — not this file — decides what a `Card` looks
 * like, which is what keeps this side portable.
 */

import type { EffectUiView, UiNode } from "./spec.ts"
import type { UiRenderer } from "./renderer.ts"

const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

const safeKey = (key: string): boolean => /^[a-zA-Z][\w-]*$/.test(key)
const scalar = (value: unknown): boolean => typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const attrs = (props: Readonly<Record<string, unknown>>): string => Object.entries(props)
  .filter(([key, value]) => key !== "value" && safeKey(key) && scalar(value))
  .map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`).join("")

const meta = (node: UiNode): string => {
  const bind = node.bind === undefined ? "" : ` data-bind="${escapeHtml(node.bind)}"`
  const item = node.item === undefined ? "" : ` data-item="${escapeHtml(node.item)}"`
  const action = node.onPress === undefined ? "" : ` data-action="${escapeHtml(node.onPress)}"`
  const repeat = node.repeat === undefined ? "" : ` data-repeat-source="${escapeHtml("state" in node.repeat.source ? node.repeat.source.state : node.repeat.source.item)}"`
  const visible = node.visible === undefined || "any" in node.visible ? "" : ` data-visible-source="${escapeHtml("state" in node.visible.source ? node.visible.source.state : node.visible.source.item)}"`
  return bind + item + action + repeat + visible
}

const renderNode = (node: UiNode, parent: string | undefined, index: number): string => {
  const id = node.id ?? (parent === undefined ? String(index) : `${parent}.${index}`)
  const value = node.props?.value
  const content = typeof value === "string" ? escapeHtml(value) : ""
  const children = node.children?.map((child, childIndex) => renderNode(child, id, childIndex)).join("") ?? ""
  const open = `<div data-node="${escapeHtml(id)}" data-component="${escapeHtml(node.component)}"${attrs(node.props ?? {})}${meta(node)}>`
  return `${open}${content}${children}</div>`
}

export const htmlRenderer: UiRenderer = {
  id: "html",
  render: (view: EffectUiView): string => {
    const title = view.title === undefined ? "" : `<h1>${escapeHtml(view.title)}</h1>`
    const body = view.nodes.map((node, index) => renderNode(node, undefined, index)).join("")
    return `<section data-effect-ui="${escapeHtml(view.viewId)}">${title}${body}</section>`
  },
}
