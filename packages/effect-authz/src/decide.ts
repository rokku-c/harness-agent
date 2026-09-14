import type { Action } from "./action.ts"
import { entryCovers, type Effect, type PolicyEntry } from "./policy.ts"
import type { Resource } from "./resource.ts"

export type DecisionEffect = Effect | "default"

export interface Decision {
  readonly allowed: boolean
  readonly effect: DecisionEffect
  readonly reason: string
  readonly matchedBy?: PolicyEntry
}

export const resolveDecision = (
  entries: readonly PolicyEntry[],
  subject: string,
  action: Action,
  target: Resource,
): Decision => {
  const matching = entries.filter((entry) => entryCovers(entry, subject, action, target))
  const denied = matching.find((entry) => entry.effect === "deny")
  if (denied) return { allowed: false, effect: "deny", reason: "explicit deny", matchedBy: denied }
  const allowed = matching.find((entry) => entry.effect === "allow")
  if (allowed) return { allowed: true, effect: "allow", reason: "explicit allow", matchedBy: allowed }
  return { allowed: false, effect: "default", reason: "default deny" }
}
