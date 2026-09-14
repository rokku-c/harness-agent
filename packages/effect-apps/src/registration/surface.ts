import {
  assessChange,
  type AssessableTool,
  type CompatPolicy,
  type UpgradeReport,
  type Violation,
} from "@effect-agent/effect-compat"
import type { EffectAppHost } from "../descriptor.ts"

export interface AppToolSurface extends AssessableTool {
  readonly name: string
}

export const readAppSurface = (host: EffectAppHost, appId: string): readonly AppToolSurface[] => {
  const registry = host.registry
  if (registry === undefined) return []
  const out: AppToolSurface[] = []
  for (const entry of registry.tools()) {
    if (entry.interfaceId !== appId) continue
    const schema = registry.schemaFor(entry.key)
    out.push({
      name: entry.tool.name,
      description: schema?.description ?? entry.tool.description,
      input: schema?.parameters,
      output: schema?.output,
    })
  }
  return out
}

export const assessSurfaceChange = (
  from: readonly AppToolSurface[],
  to: readonly AppToolSurface[],
  policy: CompatPolicy,
): UpgradeReport => {
  const violations: Violation[] = []
  const unmatched = new Map(from.map((tool) => [tool.name, tool]))

  for (const tool of to) {
    const before = unmatched.get(tool.name)
    if (before === undefined) continue
    unmatched.delete(tool.name)
    const report = assessChange(before, tool, policy)
    violations.push(...report.violations)
  }
  for (const name of unmatched.keys()) {
    violations.push({ level: "schema", mode: policy.schema, reason: `tool "${name}" was removed` })
  }

  return {
    ok: violations.every((violation) => violation.mode !== "strict"),
    violations,
    warnings: violations.filter((violation) => violation.mode === "warn"),
  }
}
