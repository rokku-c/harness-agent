/**
 * Reading a view's functions off its layout, for a view that did not name them.
 *
 * Most views are a heading, a notice or two, and then a stack of sections — one
 * per function, each a `Card`. That is enough to offer each function as a screen
 * of its own, and on a phone it is the difference between one long page and a
 * menu whose bottom you can reach. But it is a *reading*, so it is taken only
 * where it cannot be wrong, and the way it can be wrong is worth naming: it is
 * the bug the screen model exists to fix.
 *
 * A card holds the control and the line that control writes. Split them and a
 * press reports somewhere the operator is not looking — back to "press it, then
 * scroll down to find out what happened". So a card is read as a function only
 * when every control in the view sits inside one of them and every one of them
 * reads the answer of the action its own control runs, *and nothing else reads
 * that answer*: an answer two screens want is an answer shown on one of them
 * while the operator is on the other. A view that fails any test keeps the shape
 * it was written with, and `screens` is how it says what it wants instead. A
 * card with nothing to press is a panel, not a function: it stays on the first
 * screen, beside the rest of them.
 *
 * Each card is named after its heading, and an id is looked up — so the id has
 * to be one nothing else has. `reserved` is what the caller says is already
 * spoken for; a card titled "Root" is the case that needs it, since the view's
 * own first screen is called `root`.
 */

import type { UiActionSpec } from "./data-spec.ts"
import type { EffectUiView, UiNode, UiScreen } from "./spec.ts"
import { cardsOf, reachesPath, readsOf } from "./screen-reads.ts"

/** The functions read off a view: what stays on the first screen, and the screens. */
export interface DerivedScreens {
  readonly lead: readonly UiNode[]
  readonly screens: readonly UiScreen[]
}

/** A card is titled by its first heading, searched depth-first. No heading, no screen. */
const headingOf = (node: UiNode): string | undefined => {
  if (node.component === "Heading" && typeof node.props?.value === "string") return node.props.value
  for (const child of node.children ?? []) {
    const found = headingOf(child)
    if (found !== undefined) return found
  }
  return undefined
}

/** A screen id from a heading. A heading with nothing ASCII in it still needs an id. */
const slug = (title: string, taken: ReadonlySet<string>): string => {
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const base = words === "" ? "screen" : words
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return id
}

/** The view with the given nodes taken out, wherever in it they sit. */
const without = (nodes: readonly UiNode[], dropped: ReadonlySet<UiNode>): readonly UiNode[] =>
  nodes.filter((node) => !dropped.has(node)).map((node) =>
    node.children === undefined ? node : { ...node, children: without(node.children, dropped) })

/** Whether every press on this card reads its own answer here, and nothing else does. */
const selfContained = (view: EffectUiView, card: UiNode, actions: ReadonlyMap<string, UiActionSpec>): boolean => {
  const reads = readsOf([card])
  const elsewhere = readsOf(without(view.nodes, new Set([card]))).paths
  return reads.presses.every((name) => {
    const answer = actions.get(name)?.result
    return answer === undefined || (reachesPath(reads.paths, answer) && !reachesPath(elsewhere, answer))
  })
}

export const deriveScreens = (view: EffectUiView, reserved: Iterable<string>): DerivedScreens | undefined => {
  // A flow view is a document. A document is read top to bottom; it is not a tool with functions.
  if (view.layout === "flow") return undefined
  const functions = cardsOf(view.nodes).filter((card) => readsOf([card]).presses.length > 0)
  if (functions.length < 2) return undefined
  // Every control is on a screen of its own — counted, not assumed, so a control
  // outside any card (a button in a toolbar, a press a repeat draws) fails the
  // reading rather than travelling to a screen without whatever it writes to.
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
