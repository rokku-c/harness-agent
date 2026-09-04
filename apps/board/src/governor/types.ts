/** governor/types.ts - the RESOURCE CLAIM CONTRACT.
 *  Concept: an item declares ResourceClaims while doing; the governor hands
 *  them out only when every claim fits current holdings. This file owns the
 *  waiter entry + holdings shapes and the priority order table. */
import type { Deferred } from "effect"
import type { ResourceClaim } from "../domain.ts"

export type Priority = "low" | "normal" | "high" | "urgent"

export interface WaitEntry {
  readonly itemId: string
  readonly claims: ReadonlyArray<ResourceClaim>
  readonly priority: Priority
  readonly enqueuedAt: number
  readonly deferred: Deferred.Deferred<void>
}

export interface Holdings {
  /** resourceId -> (itemId -> amount held) */
  readonly held: ReadonlyMap<string, ReadonlyMap<string, number>>
}

export const PRIORITY_ORDER: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 }
