/**
 * Compatibility = graded adjudication. Four breaking-change levels (descending severity):
 * schema / deps / description / behavior. Diff along the version path version by version,
 * adjudicating with strict / warn / ignore:
 * strict violation → reject; warn violation → record and continue; ignore → skip.
 * Strong dependencies (hash references) bypass inference and are validated at runtime.
 */
import type { CompatLevel, CompatMode, CompatPolicy, ToolDef, Version } from "./types.ts"

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
export const schemaChanged = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) !== JSON.stringify(b)

const depsChanged = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean =>
  JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort())

/** Single version vs single version: compatibility adjudication from → to. */
export const assessChange = (from: ToolDef, to: ToolDef, policy: CompatPolicy): UpgradeReport => {
  const violations: Violation[] = []
  // schema/deps/description are auto-assessed levels; behavior is handled separately (requires declaration)
  const mode = (level: "schema" | "deps" | "description"): CompatMode => {
    const fromTool = to.compat?.[level]
    return fromTool !== undefined ? fromTool : policy[level]
  }

  if (schemaChanged(from.input, to.input) || schemaChanged(from.output, to.output))
    violations.push({ level: "schema", mode: mode("schema"), reason: "input/output schema changed" })

  if (depsChanged(from.deps, to.deps))
    violations.push({ level: "deps", mode: mode("deps"), reason: "dependency set changed (affects closure visibility)" })

  if (from.description !== to.description)
    violations.push({ level: "description", mode: mode("description"), reason: "description changed (affects model perception)" })

  const toBehavior = to.behavior?.changed ?? false
  const fromBehavior = from.behavior?.changed ?? false
  if (toBehavior && !fromBehavior)
    violations.push({
      level: "behavior",
      mode: policy.behavior === "require-declaration" ? "strict" : "ignore",
      reason: "behavior change declared (" + (to.behavior?.note ?? "no note") + ")"
    })

  const strict = violations.filter((violation) => violation.mode === "strict")
  const warnings = violations.filter((violation) => violation.mode === "warn")
  return { ok: strict.length === 0, violations, warnings }
}

/** Cumulative adjudication along the version chain (from → to; skeleton: diffs the two end contents directly, a real implementation walks version by version). */
export const assessUpgrade = (from: Version, to: Version, policy: CompatPolicy): UpgradeReport =>
  assessChange(from.content, to.content, policy)
