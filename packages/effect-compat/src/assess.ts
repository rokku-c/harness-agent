import { same } from "@effect-agent/canonical-json"
import type { AssessableTool, UpgradeReport, Violation } from "./assess-types.ts"
import type { CompatMode, CompatPolicy } from "./policy.ts"

export const schemaChanged = (a: unknown, b: unknown): boolean => !same(a, b)

const depsChanged = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort())

export const assessChange = (from: AssessableTool, to: AssessableTool, policy: CompatPolicy): UpgradeReport => {
  const violations: Violation[] = []
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
      mode: (to.compat?.behavior ?? policy.behavior) === "require-declaration" ? "strict" : "ignore",
      reason: "behavior change declared (" + (to.behavior?.note ?? "no note") + ")",
    })

  const strict = violations.filter((violation) => violation.mode === "strict")
  const warnings = violations.filter((violation) => violation.mode === "warn")
  return { ok: strict.length === 0, violations, warnings }
}
