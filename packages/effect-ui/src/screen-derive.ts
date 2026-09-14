import type { UiActionSpec } from "./data-spec.ts"
import type { EffectUiView, UiNode } from "./spec.ts"
import type { UiScreen } from "./screen-spec.ts"
import { cardsOf, reachesPath, readsOf } from "./screen-reads.ts"

export interface DerivedScreens {
  readonly lead: readonly UiNode[]
  readonly screens: readonly UiScreen[]
}

const headingOf = (node: UiNode): string | undefined => {
  if (node.component === "Heading" && typeof node.props?.value === "string") return node.props.value
  for (const child of node.children ?? []) {
    const found = headingOf(child)
    if (found !== undefined) return found
  }
  return undefined
}

const slug = (title: string, taken: ReadonlySet<string>): string => {
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const base = words === "" ? "screen" : words
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return id
}

const without = (nodes: readonly UiNode[], dropped: ReadonlySet<UiNode>): readonly UiNode[] =>
  nodes.filter((node) => !dropped.has(node)).map((node) =>
    node.children === undefined ? node : { ...node, children: without(node.children, dropped) })

const selfContained = (view: EffectUiView, card: UiNode, actions: ReadonlyMap<string, UiActionSpec>): boolean => {
  const reads = readsOf([card])
  const elsewhere = readsOf(without(view.nodes, new Set([card]))).paths
  return reads.presses.every((name) => {
    const answer = actions.get(name)?.result
    return answer === undefined || (reachesPath(reads.paths, answer) && !reachesPath(elsewhere, answer))
  })
}

export const deriveScreens = (view: EffectUiView, reserved: Iterable<string>): DerivedScreens | undefined => {
  if (view.layout === "flow") return undefined
  const functions = cardsOf(view.nodes).filter((card) => readsOf([card]).presses.length > 0)
  if (functions.length < 2) return undefined
  const inside = functions.reduce((total, card) => total + readsOf([card]).presses.length, 0)
  if (readsOf(view.nodes).presses.length !== inside) return undefined
  const actions = new Map((view.actions ?? []).map((action) => [action.name, action]))
  const screens: UiScreen[] = []
  const taken = new Set<string>(reserved)
  for (const card of functions) {
    const title = headingOf(card)
    if (title === undefined || !selfContained(view, card, actions)) return undefined
    const id = slug(title, taken)
    taken.add(id)
    screens.push({ id, title, nodes: [card] })
  }
  return { lead: without(view.nodes, new Set(functions)), screens }
}
