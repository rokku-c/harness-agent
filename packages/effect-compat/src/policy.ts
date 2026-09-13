/**
 * The COMPATIBILITY POLICY — one mechanism, shared by every artifact in the
 * platform (script tools, kernel, apps).
 *
 * Concept: four breaking-change levels (schema/deps/description/behavior),
 * each with its own mode. Behavior changes can never be auto-detected, so
 * they demand an explicit author declaration.
 *
 * See docs/script-sandbox.md §4/§5 and docs/architecture-rework.md §5 — the
 * platform deliberately has ONE graded adjudication, not one per artifact kind.
 */
export type CompatLevel = "schema" | "deps" | "description" | "behavior"

export type CompatMode = "strict" | "warn" | "ignore"

export interface CompatPolicy {
  readonly schema: CompatMode
  readonly deps: CompatMode
  readonly description: CompatMode
  readonly behavior: "require-declaration" | "ignore"
}

export const defaultCompat: CompatPolicy = {
  schema: "strict",
  deps: "strict",
  description: "warn",
  behavior: "require-declaration",
}
