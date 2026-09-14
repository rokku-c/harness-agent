/**
 * Which component renders each name in a spec.
 *
 * A name means whatever the surface says it means. To a view it is the design
 * system's component; to a config form it is the form's own field, which
 * carries which schema kind it holds and which row of an array it belongs to —
 * meaning a plain text input does not have. So a name the surface supplied is
 * kept, and every other name goes to the design system.
 *
 * The registry is built from the spec's own elements rather than answering
 * every name it is asked for. What this replaced was a `Proxy` that returned a
 * renderer for every property and claimed to have them all: it stood in the way
 * of JavaScript's own protocol — `then`, `toJSON`, `constructor` — until a list
 * of reserved names held it back, and it never said which names a spec had
 * actually used. A walk over the elements is total over the spec, honest about
 * its contents, and cheap; a spec has tens of elements, not thousands.
 *
 * Nothing is cached here. A config form mutates its spec in place and redraws,
 * so the registry is rebuilt along with it, and holding a stable component
 * identity per name is the resolver's job — a cache here would only be a second
 * answer to keep in step with the first.
 *
 * The resolver therefore arrives as an argument rather than an import. This
 * file is `.ts`, and the client is compiled twice: `.ts` without JSX and `.tsx`
 * with it, so a `.ts` file may not reach across into a `.tsx` one. Walking a
 * spec and building a map is a pure function anyway; what a name becomes is the
 * caller's business, and every caller is a `.tsx`.
 */

import type { Spec } from "@json-render/core"
import type { ComponentRegistry, ComponentRenderer } from "@json-render/react"

/** Every name the spec uses, once each. An element that declares no name is not one. */
const usedNames = (spec: Spec): string[] => {
  const names = new Set<string>()
  for (const element of Object.values(spec.elements ?? {})) {
    const type: unknown = element?.type
    if (typeof type === "string") names.add(type)
  }
  return [...names]
}

export const adaptRegistry = (spec: Spec, adapt: (name: string) => ComponentRenderer, ours?: ComponentRegistry): ComponentRegistry =>
  Object.fromEntries(usedNames(spec).map((name): [string, ComponentRenderer] => [name, ours?.[name] ?? adapt(name)]))
