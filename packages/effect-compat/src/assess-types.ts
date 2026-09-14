import type { CompatLevel, CompatMode, CompatPolicy } from "./policy.ts"

export interface AssessableTool {
  readonly input?: unknown
  readonly output?: unknown
  readonly deps?: readonly string[]
  readonly description?: string
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
