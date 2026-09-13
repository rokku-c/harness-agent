/**
 * What a node list reads, and what it presses.
 *
 * The questions the screen reading (screen-derive.ts) asks of a view's own
 * layout, answered by walking it: which state paths these nodes look at, which
 * actions they run, and which cards they hold. All are about the *declaration*,
 * not about running it — nothing here resolves a value or calls anything.
 *
 * These belong apart from the reading that uses them because they say nothing
 * about screens: a card, a region and a whole view are all just node lists, and
 * the same answers describe any of them.
 */

import type { UiNode } from "./spec.ts"
import type { UiCondition, UiVisibilitySpec } from "./value-spec.ts"

export interface Reads {
  /** State paths read anywhere in these nodes — what the nodes are looking at. */
  readonly paths: ReadonlySet<string>
  /** Actions these nodes press, in order. */
  readonly presses: readonly string[]
}

const conditionsOf = (visible: UiVisibilitySpec | undefined): readonly UiCondition[] =>
  visible === undefined ? [] : "any" in visible ? visible.any : [visible]

/** A source that carries no state path — an item of a repeat — reads nothing that can be named here. */
const stateOf = (source: { readonly state: string } | { readonly item: string }): string | undefined =>
  "state" in source ? source.state : undefined

export const readsOf = (nodes: readonly UiNode[]): Reads => {
  const paths = new Set<string>()
  const presses: string[] = []
  const note = (source: { readonly state: string } | { readonly item: string }): void => {
    const path = stateOf(source)
    if (path !== undefined) paths.add(path)
  }
  const walk = (node: UiNode): void => {
    if (node.bind !== undefined) paths.add(node.bind)
    for (const condition of conditionsOf(node.visible)) note(condition.source)
    if (node.repeat !== undefined) note(node.repeat.source)
    for (const param of Object.values(node.params ?? {})) {
      if (typeof param === "object" && param !== null && "state" in param) paths.add(param.state)
    }
    if (node.onPress !== undefined) presses.push(node.onPress)
    for (const child of node.children ?? []) walk(child)
  }
  for (const node of nodes) walk(node)
  return { paths, presses }
}

/**
 * Whether a read reaches a path — the path itself, something under it, or the
 * whole of something it sits in. A node bound to `/result` shows everything the
 * write at `/result/open` put there, so reading the answer is not only about
 * reading deeper than it.
 */
export const reachesPath = (paths: ReadonlySet<string>, path: string | undefined): boolean =>
  path === undefined ||
  [...paths].some((read) => read === path || read.startsWith(`${path}/`) || path.startsWith(`${read}/`))

/**
 * Every card a view holds, in reading order.
 *
 * Two kinds are left out, and both for the same reason — a card that is not a
 * section. One a `repeat` draws is a row of a list: lifted onto a screen of its
 * own it would be a screen holding one row and no list around it. One inside
 * another card is part of that card's own layout, and a section within a section
 * is still one function.
 */
export const cardsOf = (nodes: readonly UiNode[]): readonly UiNode[] => {
  const found: UiNode[] = []
  const walk = (node: UiNode, repeated: boolean, inCard: boolean): void => {
    if (node.component === "Card" && !repeated && !inCard) found.push(node)
    const nested = repeated || node.repeat !== undefined
    for (const child of node.children ?? []) walk(child, nested, inCard || node.component === "Card")
  }
  for (const node of nodes) walk(node, false, false)
  return found
}

