import type { UiNode } from "./spec.ts"
import type { UiCondition, UiVisibilitySpec } from "./value-spec.ts"

export interface Reads {
  readonly paths: ReadonlySet<string>
  readonly presses: readonly string[]
}

const conditionsOf = (visible: UiVisibilitySpec | undefined): readonly UiCondition[] =>
  visible === undefined ? [] : "any" in visible ? visible.any : [visible]

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

export const reachesPath = (paths: ReadonlySet<string>, path: string | undefined): boolean =>
  path === undefined ||
  [...paths].some((read) => read === path || read.startsWith(`${path}/`) || path.startsWith(`${read}/`))

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
