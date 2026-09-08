/**
 * effect-ui "ui-protocol-html" renderer — bridge into the repo's ui-* world.
 *
 * Maps an EffectUiView down to the existing declaration/render stack instead
 * of emitting HTML itself:
 *   EffectUiView -> ui-protocol CanvasDefinition -> ui-definition
 *   DefinitionStore -> ui-runtime resolveCanvas -> ResolvedUITree ->
 *   ui-renderer webRenderer -> HTML
 *
 * Reuses the real exports; no ui-* package is modified. A node is lowered to
 * the repo component type it corresponds to (Text/Stack/Button/Input), so a
 * ui-renderer/React renderer could be swapped in for webRenderer unchanged.
 */

import type { CanvasDefinition, Json, UINode } from "@effect-agent/ui-protocol"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { resolveCanvas } from "@effect-agent/ui-runtime"
import { webRenderer } from "@effect-agent/ui-renderer"

import type { EffectUiView, UiNodeSpec } from "./spec.ts"
import type { UiRenderer } from "./renderer.ts"

const lower = (spec: UiNodeSpec, path: readonly number[], nodes: Record<string, UINode>): string => {
  const id = spec.id ?? path.join(".")
  if (spec.kind === "text") {
    nodes[id] = { id, type: "Text", props: { value: spec.text } }
    return id
  }
  if (spec.kind === "stack") {
    const children = spec.children.map((child, index) => lower(child, [...path, index], nodes))
    const props: Record<string, Json> = { direction: spec.direction ?? "vertical" }
    if (spec.gap !== undefined) props.gap = spec.gap
    nodes[id] = { id, type: "Stack", props, children }
    return id
  }
  if (spec.kind === "button") {
    const node: UINode =
      spec.onPress === undefined
        ? { id, type: "Button", props: { label: spec.label } }
        : { id, type: "Button", props: { label: spec.label }, events: { click: [{ action: spec.onPress }] } }
    nodes[id] = node
    return id
  }
  if (spec.kind === "formField") {
    const props: Record<string, Json> = { label: spec.label }
    if (spec.value !== undefined) props.value = spec.value
    if (spec.placeholder !== undefined) props.placeholder = spec.placeholder
    nodes[id] = { id, type: "Input", props }
    return id
  }
  const children = spec.items.map((item, index) => {
    const itemId = `${id}.${index}`
    nodes[itemId] = { id: itemId, type: "Text", props: { value: item } }
    return itemId
  })
  nodes[id] = { id, type: "Stack", props: { role: "list" }, children }
  return id
}

const toCanvas = (view: EffectUiView): CanvasDefinition => {
  const nodes: Record<string, UINode> = {}
  const rootNodeIds = view.nodes.map((node, index) => lower(node, [index], nodes))
  return { canvasId: view.viewId, title: view.title ?? view.viewId, nodes, rootNodeIds, version: 1 }
}

export const effectUiWebRenderer: UiRenderer = {
  id: "ui-protocol-html",
  render: (view: EffectUiView): string => {
    const store = makeDefinitionStore({ canvases: { [view.viewId]: toCanvas(view) }, components: [] })
    return webRenderer.render(resolveCanvas(store, view.viewId))
  },
}
