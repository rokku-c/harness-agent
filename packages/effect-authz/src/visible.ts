/**
 * effect-authz — the projection.
 *
 * `visibleResources` filters candidates down to what the principal may do. It
 * calls the very same resolver as `decide`, so "not visible ⇒ not callable"
 * holds by construction rather than by convention: a tool missing from the
 * projected list cannot pass the direct-call check.
 *
 * It records no audit events — one per tool on every list call would drown the
 * table. The caller emits its own coarse "list" row if it wants one.
 */

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
