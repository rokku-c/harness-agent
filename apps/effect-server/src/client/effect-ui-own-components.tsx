/**
 * What a view may name that the design system does not have.
 *
 * It is a constant rather than a fresh object per draw because `@json-render`
 * keys its own per-registry metadata on the registry's identity: a new object is
 * a new registry, and everything under it is rebuilt from nothing.
 */
import type { ComponentRegistry } from "@json-render/react"
import { Preview } from "./adapt/preview.tsx"

export const ownComponents: ComponentRegistry = { Preview }
