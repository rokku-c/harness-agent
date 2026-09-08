/**
 * RenderContract — the "rules" that tell an agent how this UI renders.
 *
 * For every element: what component it is, what data it reads (a state path),
 * whether it is display-only, and what is interactive (on -> action + how to
 * build args). A document-level dictionary + empty-data rule explain the
 * rendering even with zero data. Any representation (json/toml/compact) is
 * projected from this same contract so interactions stay unambiguous.
 */

import type { EffectUiView, UiNodeSpec } from "./spec.ts"

export type UiComponent = "Text" | "Stack" | "Button" | "Input" | "List"

export interface InteractionRule {
  readonly on: "click" | "input" | "submit"
  readonly action: string
  /** argName -> static value or "$state/<path>" binding. */
  readonly args?: Readonly<Record<string, string>>
  /** component ids (refs) to refresh LOCALLY after this action. */
  readonly refresh?: readonly string[]
}

export interface ContractRefresh {
  /** ui updates are PARTIAL by default (only the affected component refs). */
  readonly default: "partial"
  readonly modes: readonly ("partial" | "full")[]
  readonly partialVia: "component-refs"
  /** partial patches need the base frame; warn when it may be evicted. */
  readonly warnWhenBaseFrameMissing: boolean
}

export interface ContractElement {
  readonly id: string
  readonly component: UiComponent
  readonly data?: string
  /** false = control/interactive surface; true (default) = data shown as-is. */
  readonly display?: boolean
  /** collapsible content (full/partial collapse, expand on click/enter). */
  readonly collapsible?: boolean
  readonly children?: readonly string[]
  readonly interactive?: readonly InteractionRule[]
}

export interface ContractRules {
  /** elements whose content may be collapsed (not all shown at once). */
  readonly collapsibleIds: readonly string[]
  /** expanding one collapses the others (accordion). */
  readonly exclusive: boolean
  readonly expandOn: "click" | "enter"
}

export interface RenderContract {
  readonly lang: "contract"
  readonly elements: readonly ContractElement[]
  /** the agent-operable actions this app exposes (schemas). */
  readonly actions: ReadonlyArray<{ name: string; description?: string; inputSchema?: unknown }>
  /** how this renders when data is empty (0-data still renders). */
  readonly emptyDataRule: string
  readonly rules: ContractRules
  readonly refresh: ContractRefresh
}

const kindComponent: Record<UiNodeSpec["kind"], UiComponent> = {
  text: "Text",
  stack: "Stack",
  button: "Button",
  formField: "Input",
  list: "List",
}

export const makeRenderContract = (
  view: EffectUiView,
  actions: ReadonlyArray<{ name: string; description?: string; inputSchema?: unknown }> = [],
): RenderContract => {
  const actionNames = new Set(actions.map((a) => a.name))
  const elements: ContractElement[] = []

  const walk = (nodes: readonly UiNodeSpec[], path: readonly number[]): string[] => {
    const ids: string[] = []
    nodes.forEach((node, index) => {
      const id = node.id ?? path.concat(index).join(".")
      const interactive: InteractionRule[] = []
      if (node.kind === "button" && node.onPress !== undefined && actionNames.has(node.onPress)) {
        interactive.push({ on: "click", action: node.onPress, args: {} })
      }
      const bound = "bind" in node ? (node as { bind?: string }).bind : undefined
      const element: ContractElement = {
        id,
        component: kindComponent[node.kind],
        display: node.kind === "text" || node.kind === "list",
        ...(node.kind === "list" ? { collapsible: true } : {}),
        ...(bound !== undefined ? { data: bound } : {}),
        ...(node.kind === "stack" ? { children: walk(node.children, path.concat(index)) } : {}),
        ...(interactive.length > 0 ? { interactive } : {}),
      }
      elements.push(element)
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
