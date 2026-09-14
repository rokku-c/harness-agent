import type { Action } from "./action.ts"
import { resolveDecision } from "./decide.ts"
import type { PolicyEntry } from "./policy.ts"
import type { Resource } from "./resource.ts"

export const visibleResources = (
  entries: readonly PolicyEntry[],
  subject: string,
  action: Action,
  candidates: readonly Resource[],
): readonly Resource[] =>
  candidates.filter((resource) => resolveDecision(entries, subject, action, resource).allowed)
