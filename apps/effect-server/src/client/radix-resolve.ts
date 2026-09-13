/**
 * Resolving a view's component name against the design system.
 *
 * A node names what it wants the way `@radix-ui/themes` exports it, dotted for
 * a subcomponent: `"Card"`, `"Badge"`, `"Table.Row"`. Resolution is a walk into
 * the library's own exports, so a component we have never heard of works the
 * moment the library has it. There is no list here to keep in step, which is
 * the point: the vocabulary belongs to the design system, not to us.
 */

import * as RadixThemes from "@radix-ui/themes"
import type { ComponentType } from "react"

const exports = RadixThemes as unknown as Record<string, unknown>

/**
 * A name only resolves if it names a component. A *namespace* — `TextField`, the
 * object that holds `.Root` — walks successfully but is not renderable, and
 * handing one to React is a crash that takes the whole view down. Rejecting it
 * here turns that typo into the one red callout naming the component instead.
 */
const isComponent = (node: unknown): boolean =>
  typeof node === "function" || (typeof node === "object" && node !== null && "$$typeof" in node)

export const resolveComponent = (name: string): ComponentType<never> | undefined => {
  let node: unknown = exports
  for (const key of name.split(".")) {
    if (typeof node !== "object" || node === null) return undefined
    node = (node as Record<string, unknown>)[key]
  }
  return isComponent(node) ? node as ComponentType<never> : undefined
}

/** Every name a view may use, for a client that wants to offer them. */
export const radixNames = (): ReadonlyArray<string> =>
  Object.keys(exports).filter((name) => isComponent(exports[name]))
