/**
 * effect-authz — the action vocabulary.
 *
 * One action triple (`read | call | write`) is the whole surface. The plane
 * vocabulary that already exists in the repo (effect-apps `AppsPlane`) maps
 * onto it here, so its consumer compiles down to the same engine.
 *
 * The union type is re-declared locally (same strings) instead of being
 * imported: this package must stay dependency-free, because its consumers
 * depend on *it* and the arrow must not point back.
 */

export type Action = "read" | "call" | "write"

/** Mirrors `AppsPlane` from effect-apps (packages/effect-apps/src/catalog.ts). */
export type AppsPlaneLike = "interface" | "ui" | "store" | "config"

export const forAppsPlane = (plane: AppsPlaneLike, mutating = false): Action =>
  plane === "interface" ? "call" : mutating ? "write" : "read"
