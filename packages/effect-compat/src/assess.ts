/**
 * Compatibility = graded adjudication. Four breaking-change levels (descending severity):
 * schema / deps / description / behavior. Diff along the version path version by version,
 * adjudicating with strict / warn / ignore:
 * strict violation → reject; warn violation → record and continue; ignore → skip.
 * Strong dependencies (hash references) bypass inference and are validated at runtime.
 *
 * The input is deliberately STRUCTURAL (see {@link AssessableTool}): a script
 * `ToolDef` and an app's tool surface both satisfy it, so the same function
 * adjudicates both. Upgrade and rollback are the same call with the arguments
 * swapped — that symmetry is the point (docs/script-sandbox.md §5.2).
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

/** Structured diff (skeleton: canonical JSON equality; a real implementation should do JSON Schema subset checking). */
export const schemaChanged = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b)

const depsChanged = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort())

/** Single version vs single version: compatibility adjudication from → to. */
export const assessChange = (from: AssessableTool, to: AssessableTool, policy: CompatPolicy): UpgradeReport => {
  const violations: Violation[] = []
  // schema/deps/description are auto-assessed levels; behavior is handled separately (requires declaration)
  const mode = (level: "schema" | "deps" | "description"): CompatMode => {
    const fromTool = to.compat?.[level]
    return fromTool !== undefined ? fromTool : policy[level]
  }

  if (schemaChanged(from.input, to.input) || schemaChanged(from.output, to.output))
    violations.push({ level: "schema", mode: mode("schema"), reason: "input/output schema changed" })

  if (depsChanged(from.deps ?? [], to.deps ?? []))
    violations.push({ level: "deps", mode: mode("deps"), reason: "dependency set changed (affects closure visibility)" })

  if (from.description !== to.description)
    violations.push({
      level: "description",
      mode: mode("description"),
      reason: "description changed (affects model perception)",
    })

  const toBehavior = to.behavior?.changed ?? false
  const fromBehavior = from.behavior?.changed ?? false
  if (toBehavior && !fromBehavior)
    violations.push({
      level: "behavior",
      // The override is consulted here as it is for the other three levels:
      // `compat` is documented as the artifact's override of the policy levels,
      // and a behavior that a policy demands be declared is exactly the level an
      // artifact has a reason to override.
      mode: (to.compat?.behavior ?? policy.behavior) === "require-declaration" ? "strict" : "ignore",
      reason: "behavior change declared (" + (to.behavior?.note ?? "no note") + ")",
    })

  const strict = violations.filter((violation) => violation.mode === "strict")
  const warnings = violations.filter((violation) => violation.mode === "warn")
  return { ok: strict.length === 0, violations, warnings }
}

/** Anything carrying an adjudicable body — a script `Version`, an app generation, … */
export interface VersionLike<T extends AssessableTool> {
  readonly content: T
}

/**
 * Cumulative adjudication along the version chain (from → to; skeleton: diffs the two end contents
 * directly, a real implementation walks version by version).
 *
 * Rollback is the same call with (to, from) swapped — there is no separate
 * "can we go back" rule to keep in sync.
 */
export const assessUpgrade = <T extends AssessableTool>(
  from: VersionLike<T>,
  to: VersionLike<T>,
  policy: CompatPolicy,
): UpgradeReport => assessChange(from.content, to.content, policy)

/** The adjudication run backwards: may we go from `to` back to `from`? */
export const assessRollback = <T extends AssessableTool>(
  from: VersionLike<T>,
  to: VersionLike<T>,
  policy: CompatPolicy,
): UpgradeReport => assessUpgrade(to, from, policy)
