/**
 * A view's component name, resolved against the design system, and against the
 * icon family's closed table when the design system has no such name.
 *
 * A node names what it wants the way `@radix-ui/themes` exports it, dotted for
 * a subcomponent: `"Card"`, `"Badge"`, `"Table.Row"`. Resolving is a walk into
 * the library's own exports, so a name we have never heard of works the moment
 * the library has it. There is no list of names here, and that is the point:
 * the vocabulary belongs to the design system, not to us. Glyphs are the one
 * exception and `glyphs.ts` says why; the design system is still tried first,
 * so nothing about this walk weakens for the names that are already its.
 *
 * What the walk has to be is total. A name that misses, a name that stops on a
 * namespace, a name with a dot where a segment should be — each is the same
 * answer, and the answer is that this name does not resolve. The caller says so
 * in the view; nothing here throws, because throwing inside a render takes down
 * every other node in the tree with it.
 */

import * as RadixThemes from "@radix-ui/themes"
import type { ComponentType } from "react"
import { glyphs } from "./glyphs.ts"

/** The library as a plain bag of exports — the walk knows nothing else about it. */
const library = RadixThemes as unknown as Record<string, unknown>

/**
 * A name only resolves if it names a component. A *namespace* — `TextField`,
 * the object that holds `.Root` — walks cleanly but is not renderable, and
 * handing one to React is a crash that takes the whole view down. Refusing it
 * here turns it into the one name the caller reports instead.
 */
const isComponent = (node: unknown): boolean =>
  typeof node === "function" || (typeof node === "object" && node !== null && "$$typeof" in node)

/**
 * The export a name points at, or nothing when the walk cannot get there. Each
 * segment is a step into an object and nothing else, so a name that runs into a
 * function, a string, or a gap between two dots stops rather than reaching past
 * it: `"Card."` and `"a..b"` are misses, as they must be, since neither names
 * anything the library can have.
 */
const walk = (name: string): unknown => {
  let node: unknown = library
  for (const segment of name.split(".")) {
    if (segment === "" || typeof node !== "object" || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return node
}

export const libraryComponent = (name: string): ComponentType<never> | undefined => {
  const node = walk(name)
  if (isComponent(node)) return node as ComponentType<never>
  // A glyph is named from `glyphs.ts` and not walked, and the reason is size:
  // the icon family exports 3024 components, so the open walk that serves the
  // design system would import every one of them into the bundle. §8 wants one
  // glyph per concept anyway, so the closed table is the design's own shape.
  return glyphs[name]
}
