/**
 * Cumulative adjudication along a version chain, and its inverse.
 *
 * The chain is walked one step at a time by assess.ts; what lives here is the
 * walk as a call site sees it. Rollback is that same call with (to, from)
 * swapped — there is no separate "can we go back" rule, so rollback cannot drift
 * away from upgrade (docs/script-sandbox.md §5.2).
 */
import { assessChange } from "./assess.ts"
import type { AssessableTool, UpgradeReport } from "./assess-types.ts"
import type { CompatPolicy } from "./policy.ts"

/** Anything carrying an adjudicable body — a script `Version`, an app generation, … */
export interface VersionLike<T extends AssessableTool> {
  readonly content: T
}

/**
 * Cumulative adjudication along the version chain (from → to; skeleton: diffs the two end contents
 * directly, a real implementation walks version by version).
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
