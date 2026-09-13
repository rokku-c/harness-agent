/**
 * effect-ui "ui-protocol-html" renderer — bridge into the repo's ui-* world.
 *
 * Maps an EffectUiView down to the existing declaration/render stack instead
 * of emitting HTML itself:
 *   EffectUiView -> ui-protocol CanvasDefinition -> ui-definition
 *   DefinitionStore -> ui-runtime resolveCanvas -> ResolvedUITree ->
 *   ui-renderer webRenderer -> HTML
 *
 * Reuses the real exports; no ui-* package is modified. A node keeps the
 * component name it was declared with, so the ui-* side sees the same
 * vocabulary the browser does.
 */

import type { CanvasDefinition, Json, UINode } from "@effect-agent/ui-protocol"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { resolveCanvas } from "@effect-agent/ui-runtime"
import { webRenderer } from "@effect-agent/ui-renderer"

import type { EffectUiView, UiNode } from "./spec.ts"
import type { UiCondition, UiVisibilitySpec } from "./value-spec.ts"
import type { UiRenderer } from "./renderer.ts"

const source = (value: { readonly state: string } | { readonly item: string }): Json =>
  "state" in value ? { $state: value.state } : { $item: value.item }

const condition = (spec: UiCondition): Json =>
  ({ source: source(spec.source), equals: spec.equals, not: spec.not }) as Json

const visibility = (spec: UiVisibilitySpec): Json => "any" in spec ? { any: spec.any.map(condition) } : condition(spec)

const lower = (spec: UiNode, parent: string | undefined, index: number, nodes: Record<string, UINode>): string => {
  const id = spec.id ?? (parent === undefined ? String(index) : `${parent}.${index}`)
  const children = (spec.children ?? []).map((child, childIndex) => lower(child, id, childIndex, nodes))
  const props: Record<string, Json> = { ...(spec.props as Record<string, Json> | undefined) }
  if (spec.bind !== undefined) props[spec.as ?? "value"] = { $state: spec.bind }
  if (spec.item !== undefined) props[spec.as ?? "value"] = { $item: spec.item }
  if (spec.repeat !== undefined) props.repeat = { source: source(spec.repeat.source), key: spec.repeat.key } as Json
  if (spec.visible !== undefined) props.visible = visibility(spec.visible)
  nodes[id] = {
    id, type: spec.component, props,
    ...(children.length === 0 ? {} : { children }),
    ...(spec.onPress === undefined ? {} : { events: { click: [{ action: spec.onPress }] } }),
  }
  return id
}

const toCanvas = (view: EffectUiView): CanvasDefinition => {
  const nodes: Record<string, UINode> = {}
  const rootNodeIds = view.nodes.map((node, index) => lower(node, undefined, index, nodes))
  return { canvasId: view.viewId, title: view.title ?? view.viewId, nodes, rootNodeIds, version: 1 }
}

export const effectUiWebRenderer: UiRenderer = {
  id: "ui-protocol-html",
  render: (view: EffectUiView): string => {
    const store = makeDefinitionStore({ canvases: { [view.viewId]: toCanvas(view) }, components: [] })
    return webRenderer.render(resolveCanvas(store, view.viewId))
  },
}
