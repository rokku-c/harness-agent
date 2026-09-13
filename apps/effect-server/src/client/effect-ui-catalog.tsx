/**
 * The client's component registry.
 *
 * It is deliberately not a list. A view may name any `@radix-ui/themes`
 * component, so the registry answers every name with the one renderer that
 * resolves the name at render time. Enumerating the library here would be
 * inventing a vocabulary we have decided not to own — and it would fall out of
 * step with the library on the next upgrade.
 *
 * `overrides` exists for a surface that renders *its* own components under a
 * shared name: the config form's fields carry meaning (which schema kind a
 * field is, which row of an array it belongs to) that a text input does not.
 */

import type { ComponentRegistry } from "@json-render/react"
import { RadixRenderer } from "./radix-render.tsx"

/** Keys that belong to the language, not to the design system. */
const reserved = new Set(["then", "toJSON", "constructor", "prototype", "toString"])

export const makeEffectUiRegistry = (overrides: ComponentRegistry = {}): ComponentRegistry => new Proxy(overrides, {
  get: (target, name) => typeof name !== "string" || name.startsWith("$") || reserved.has(name)
    ? Reflect.get(target, name)
    : (target[name] ?? RadixRenderer),
  has: () => true,
})
