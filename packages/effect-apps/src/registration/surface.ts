/**
 * An app's tool surface: what it currently exposes, and how two of them are
 * adjudicated.
 *
 * The surface is read back from the live registry rather than from the
 * descriptor — the descriptor is what the app *said*, the registry is what is
 * actually being served, and a generation is only comparable to another if both
 * sides come from the same place. Comparison is @effect-agent/effect-compat's
 * four-level model, the same adjudicator the script sandbox uses (§5, "one
 * recursive mechanism").
 */
import {
  assessChange,
  type AssessableTool,
  type CompatPolicy,
  type UpgradeReport,
  type Violation,
} from "@effect-agent/effect-compat"
import type { EffectAppHost } from "../descriptor.ts"

/** One tool of an app's surface, in the shape the shared adjudicator understands. */
export interface AppToolSurface extends AssessableTool {
  readonly name: string
}

/** The tool surface an app currently exposes, read back from the live registry. */
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

/**
 * Surface-level adjudication: pairwise for tools present in both generations,
 * as a schema-level removal when a tool disappears. Additions are not a
 * violation — nothing that could already call the app breaks because a new tool
 * appeared.
 */
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
