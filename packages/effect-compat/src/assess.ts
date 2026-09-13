/**
 * Compatibility = graded adjudication. Four breaking-change levels (descending severity):
 * schema / deps / description / behavior. Diff along the version path version by version,
 * adjudicating with strict / warn / ignore:
 * strict violation → reject; warn violation → record and continue; ignore → skip.
 * Strong dependencies (hash references) bypass inference and are validated at runtime.
 *
 * What this file owns is one step of the walk — `from` → `to`, and the four
 * comparisons that decide it. Upgrade and rollback are that same step with the
 * arguments swapped, which is the point (docs/script-sandbox.md §5.2); the chain
 * they walk is assess-chain.ts, and the shapes are assess-types.ts.
 */
import type { AssessableTool, UpgradeReport, Violation } from "./assess-types.ts"
import type { CompatMode, CompatPolicy } from "./policy.ts"

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
