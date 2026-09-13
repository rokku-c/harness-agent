/**
 * effect-authz — the action vocabulary.
 *
 * One action triple (`read | call | write`) is the whole surface. The plane
 * vocabularies that already exist in the repo (effect-planes `PlaneScope`,
 * effect-apps `AppsPlane`) map onto it here, so both consumers compile down to
 * the same engine.
 *
 * The two union types are re-declared locally (same strings) instead of being
 * imported: this package must stay dependency-free, because effect-planes will
 * depend on *it* in a later phase and the arrow must not point back.
 */

export type Action = "read" | "call" | "write"

/** Mirrors `PlaneScope` from effect-planes (packages/effect-planes/src/types.ts). */
export type PlaneScopeLike = "ui" | "store" | "store-write" | "interface"

/** Mirrors `AppsPlane` from effect-apps (packages/effect-apps/src/catalog.ts). */
export type AppsPlaneLike = "interface" | "ui" | "store" | "config"

export const forPlaneScope = (scope: PlaneScopeLike): Action =>
  scope === "interface" ? "call" : scope === "store-write" ? "write" : "read"

export const forAppsPlane = (plane: AppsPlaneLike, mutating = false): Action =>
  plane === "interface" ? "call" : mutating ? "write" : "read"
