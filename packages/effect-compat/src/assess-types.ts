/**
 * The shapes the graded adjudication speaks in: the artifact as the adjudicator
 * sees it, and the report it hands back.
 *
 * The input is deliberately STRUCTURAL (see {@link AssessableTool}): a script
 * `ToolDef` and an app's tool surface both satisfy it, so the same function
 * adjudicates both — which is why these shapes live apart from the step that
 * reads them.
 */
import type { CompatLevel, CompatMode, CompatPolicy } from "./policy.ts"

/**
 * The minimum shape an adjudicable artifact exposes. Every field is optional so
 * a caller can diff the part of a surface it actually knows about; a missing
 * field is "unchanged" rather than "broken".
 */
export interface AssessableTool {
  readonly input?: unknown
  readonly output?: unknown
  readonly deps?: readonly string[]
  readonly description?: string
  /** per-artifact override of the policy levels */
  readonly compat?: Partial<CompatPolicy>
  readonly behavior?: { readonly changed?: boolean; readonly note?: string }
}

/** One level that changed, and the mode that adjudicated it. */
export interface Violation {
  readonly level: CompatLevel
  readonly mode: CompatMode
  readonly reason: string
}

export interface UpgradeReport {
  readonly ok: boolean
  readonly violations: ReadonlyArray<Violation>
  readonly warnings: ReadonlyArray<Violation>
}
