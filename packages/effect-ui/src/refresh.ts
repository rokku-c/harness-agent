/**
 * Partial refresh helpers — updates are PARTIAL by default and only affect the
 * components a rule names (via their stable refs). Full refresh only when the
 * caller asks for it. Because a partial patch is relative to a base frame, we
 * must warn when that base frame may have been dropped from the model context.
 */

import type { RenderContract } from "./contract.ts"

/** component refs an action says to refresh locally ([] => whole UI). */
export const refreshTargets = (contract: RenderContract, action: string): readonly string[] => {
  for (const e of contract.elements) {
    const rule = (e.interactive ?? []).find((i) => i.action === action)
    if (rule !== undefined && rule.refresh !== undefined && rule.refresh.length > 0) return rule.refresh
  }
  return []
}

export const defaultRefreshMode = (contract: RenderContract): "partial" | "full" => contract.refresh.default

/**
 * Partial patches assume the base frame still describes the untouched parts.
 * If that frame was removed from the model context the patch is semantically
 * incomplete — say so instead of silently applying it.
 */
export const warnPartialWithoutBase = (
  refs: readonly string[],
  baseFrameKnown: boolean,
): string | null => {
  if (refs.length === 0 || baseFrameKnown) return null
  return `partial refresh targets [${refs.join(", ")}] but the base frame may be out of context — ` +
    "a patch relative to an evicted base frame is semantically incomplete; include the base snapshot or refresh the whole UI."
}
