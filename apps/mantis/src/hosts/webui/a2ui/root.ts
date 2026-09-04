/**
 * a2ui/root.ts - the SURFACE ROOT NORMALIZER.
 *
 * Concept: the official renderer's resolver roots its tree at a component
 * whose id is the literal "root". Agents commonly emit a FLAT list with no
 * root - the renderer then shows "[Loading root...]" forever (only visible
 * in a real browser; the stored data looked fine). Normalize: no "root"
 * declared -> a single top-level component becomes the root itself (props
 * kept), several top-level components are hosted by a synthetic root
 * Column in order. Batches that already declare a "root" pass untouched.
 */
import type { A2uiMessage } from "./types.ts"

export const ensureSurfaceRoot = (messages: ReadonlyArray<A2uiMessage>): A2uiMessage[] => {
  const result: A2uiMessage[] = []
  for (const message of messages) {
    if (!("updateComponents" in message)) { result.push(message); continue }
    const update = message.updateComponents
    const components = update.components as Array<Record<string, unknown>>
    if (components.some((component) => String(component.id) === "root")) {
      result.push(message)
      continue
    }
    const referenced = new Set<string>()
    for (const component of components) {
      if (typeof component.child === "string") referenced.add(component.child)
      if (Array.isArray(component.children))
        for (const child of component.children) if (typeof child === "string") referenced.add(child)
    }
    const roots = components.filter((component) => !referenced.has(String(component.id)))
    const wrapped: Array<Record<string, unknown>> =
      roots.length === 1
        ? // a single top-level component becomes the root itself (props kept)
          [{ ...roots[0]!, id: "root" }, ...components.filter((component) => component !== roots[0])]
        : // several top-level components: a synthetic root Column hosts them in order
          [{ id: "root", component: "Column", children: roots.map((component) => component.id) }, ...components]
    result.push({
      version: message.version,
      updateComponents: { surfaceId: update.surfaceId, components: wrapped }
    } as A2uiMessage)
  }
  return result
}
