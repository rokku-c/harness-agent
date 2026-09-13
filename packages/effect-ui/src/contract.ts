/**
 * RenderContract — the "rules" that tell an agent how this UI renders.
 *
 * For every element: what component it is, what data it reads (a state path),
 * whether it is display-only, and what is interactive (on -> action + how to
 * build args). A document-level dictionary + empty-data rule explain the
 * rendering even with zero data. Any representation (json/toml/compact) is
 * projected from this same contract so interactions stay unambiguous.
 */

import type { ContractElement, InteractionRule, RenderContract } from "./contract-types.ts"
import type { EffectUiView, UiNode } from "./spec.ts"

export type { ContractElement, ContractRefresh, ContractRules, InteractionRule, RenderContract, UiComponent } from "./contract-types.ts"

export const makeRenderContract = (
  view: EffectUiView,
  actions: ReadonlyArray<{ name: string; description?: string; inputSchema?: unknown }> = [],
): RenderContract => {
  const actionNames = new Set(actions.map((a) => a.name))
  const elements: ContractElement[] = []

  const walk = (nodes: readonly UiNode[], path: readonly number[]): string[] => {
    const ids: string[] = []
    nodes.forEach((node, index) => {
      const id = node.id ?? path.concat(index).join(".")
      const children = walk(node.children ?? [], path.concat(index))
      const interactive: InteractionRule[] = node.onPress !== undefined && actionNames.has(node.onPress)
        ? [{ on: "click", action: node.onPress, args: {} }]
        : []
      elements.push({
        id,
        component: node.component,
        display: node.onPress === undefined,
        // A repeating node is the long list the token view collapses.
        ...(node.repeat === undefined ? {} : { collapsible: true }),
        ...(node.bind === undefined ? {} : { data: node.bind }),
        ...(children.length === 0 ? {} : { children }),
        ...(interactive.length === 0 ? {} : { interactive }),
      })
      ids.push(id)
    })
    return ids
  }

  walk(view.nodes, [])
  const collapsibleIds = elements.filter((e) => e.collapsible === true).map((e) => e.id)
  return {
    lang: "contract",
    elements,
    actions,
    emptyDataRule:
      "0 data renders the layout only: components show empty values, interactive controls stay enabled (they carry their own args).",
    rules: { collapsibleIds, exclusive: true, expandOn: "click" },
    refresh: {
      default: "partial",
      modes: ["partial", "full"],
      partialVia: "component-refs",
      warnWhenBaseFrameMissing: true,
    },
  }
}
