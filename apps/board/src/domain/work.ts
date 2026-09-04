/** domain/work.ts - WORK ITEMS as data.
 *  Concept: doing means an executor holds the item AND all its Resource-
 *  Claims (the governor granted the whole claim group atomically); ready
 *  means unblocked (dependencies done). */
import type { ResourceClaim } from "./resources.ts"

export const WORK_ITEM_STATES = ["todo", "ready", "doing", "blocked", "done", "failed", "cancelled"] as const
export type WorkItemState = (typeof WORK_ITEM_STATES)[number]
export type Priority = "low" | "normal" | "high" | "urgent"
export type WorkItemKind = "goal" | "group" | "leaf"

export interface WorkItem {
  readonly itemId: string
  /** Tree role; omitted by v1 snapshots and treated as a leaf. */
  readonly kind?: WorkItemKind
  readonly title: string
  readonly body?: string
  readonly state: WorkItemState
  readonly priority: Priority
  /** which executor this item is (or was) assigned to */
  readonly assigneeId?: string
  /** resources this item must hold while doing - claimed atomically */
  readonly requires?: ReadonlyArray<ResourceClaim>
  /** parent item id when this is a child of a coordinated breakdown */
  readonly parentId?: string
  /** items that must reach done before this one may start */
  readonly dependencies: ReadonlyArray<string>
  /** stable id list of subtasks created for this item (breakdown) */
  readonly children: ReadonlyArray<string>
  readonly labels: ReadonlyArray<string>
  /** blocked reason when state === "blocked" */
  readonly blockedReason?: string
  /** result / failure message attached on done / failed */
  readonly result?: string
  readonly createdAt: number
  readonly updatedAt: number
  /** Optimistic concurrency token for tree edits. */
  readonly version?: number
}
