/**
 * effect-ui "html" renderer — a self-contained declarative renderer.
 *
 * Owns its own HTML conventions (data-effect-ui, data-node, semantic tags).
 * It depends only on the effect-ui spec types, so it is fully decoupled from
 * the repo's ui-* renderer world (the seam's "portable" side).
 */

import type { EffectUiView, UiNodeSpec } from "./spec.ts"
import type { UiRenderer } from "./renderer.ts"

const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

const nodeId = (id: string | undefined, path: readonly number[]): string => escapeHtml(id ?? path.join("."))

const renderNode = (spec: UiNodeSpec, path: readonly number[]): string => {
  const id = nodeId(spec.id, path)
  if (spec.kind === "text") return `<p data-node="${id}">${escapeHtml(spec.text)}</p>`
  if (spec.kind === "stack") {
    const gap = spec.gap === undefined ? "" : ` data-gap="${spec.gap}"`
    const direction = spec.direction ?? "vertical"
    const body = spec.children.map((child, index) => renderNode(child, [...path, index])).join("")
    return `<div data-node="${id}" data-role="${direction}"${gap}>${body}</div>`
  }
  if (spec.kind === "button") {
    const action = spec.onPress === undefined ? "" : ` data-action="${escapeHtml(spec.onPress)}"`
    return `<button type="button" data-node="${id}"${action}>${escapeHtml(spec.label)}</button>`
  }
  if (spec.kind === "formField") {
    const value = spec.value === undefined ? "" : ` value="${escapeHtml(spec.value)}"`
    const placeholder = spec.placeholder === undefined ? "" : ` placeholder="${escapeHtml(spec.placeholder)}"`
    return `<label data-node="${id}">${escapeHtml(spec.label)}<input type="text"${value}${placeholder} /></label>`
  }
  const items = spec.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
  return `<ul data-node="${id}">${items}</ul>`
}

export const htmlRenderer: UiRenderer = {
  id: "html",
  render: (view: EffectUiView): string => {
    const title = view.title === undefined ? "" : `<h1>${escapeHtml(view.title)}</h1>`
    const body = view.nodes.map((node, index) => renderNode(node, [index])).join("")
    return `<section data-effect-ui="${escapeHtml(view.viewId)}">${title}${body}</section>`
  },
}
