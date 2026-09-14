import { assessChange } from "./assess.ts"
import type { AssessableTool, UpgradeReport } from "./assess-types.ts"
import type { CompatPolicy } from "./policy.ts"

export interface VersionLike<T extends AssessableTool> {
  readonly content: T
}

export const assessUpgrade = <T extends AssessableTool>(
  from: VersionLike<T>,
  to: VersionLike<T>,
  policy: CompatPolicy,
): UpgradeReport => assessChange(from.content, to.content, policy)

export const assessRollback = <T extends AssessableTool>(
  from: VersionLike<T>,
  to: VersionLike<T>,
  policy: CompatPolicy,
): UpgradeReport => assessUpgrade(to, from, policy)
