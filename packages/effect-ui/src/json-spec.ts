/**
 * EffectUiView -> @json-render Spec bridge.
 *
 * The projection is deliberately close to the identity: a node's `component`
 * becomes the element's `type`, its `props` becomes the element's `props`, and
 * its children become child element ids. The only translation is the one a
 * static document does not need — `bind` and `item` become `$bindState` / `$item`
 * expressions, and `onPress` becomes the element's `press` event.
 *
 * Component names are therefore @radix-ui/themes' own. Nothing here enumerates
 * them; the client resolves a name against the library's exports.
 */

import type { Spec, UIElement } from "@json-render/core"
import type { EffectUiView, UiNode, UiViewLayout } from "./spec.ts"
import { actionParams, jsonBind, jsonRepeat, jsonVisible } from "./json-values.ts"

type Elements = Record<string, UIElement>

/** Live content, written to the prop the conversion layer reads. */
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

/**
 * The frame the view's nodes are stacked in, and the only place `layout` is read.
 * Both forms are a column; they differ in what the column is as tall as.
 *
 * `screen` (the default) is exactly as tall as the area the shell gave the view, so
 * the frame never scrolls and nothing in the view can push the page's own scrollbar.
 * That is the whole guarantee, and it comes with the obligation that goes with it: a
 * node that needs more room than one screen must say so with a `region`, which
 * scrolls inside its own box. A node that does not is *shrunk* to fit rather than
 * scrolled — `flex-shrink` defaults to 1 — and where a component clips its own
 * overflow (a `Card` does) the bottom of its content is not scrolled past but
 * quietly missing. Every view that can exceed a screen therefore declares a region;
 * `flow` is for a view that is genuinely a document.
 *
 * `flow` is as tall as its content and takes the page's scrollbar, which is what
 * every view did before there was a choice.
 */
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

/** A view-less node list, for a document the host composes itself. */
export const nodesToSpec = (nodes: readonly UiNode[]): Spec => viewToJsonSpec({ viewId: "document", nodes })
