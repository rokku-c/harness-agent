/** domain/machine.ts - the WORK-ITEM STATE MACHINE (pure, total).
 *  Concept: todo -> ready -> doing -> done with blocked as a waiting state
 *  (resource/dependency/human) and failed | cancelled as the other exits.
 *  TRANSITIONS is the complete table; canTransition is total over it. */
import type { WorkItemState } from "./work.ts"

export interface Transition {
  readonly from: WorkItemState
  readonly to: WorkItemState
}

export const TRANSITIONS: ReadonlyArray<Transition> = [
  { from: "todo", to: "ready" },
  { from: "todo", to: "blocked" },
  { from: "todo", to: "cancelled" },
  { from: "ready", to: "doing" },
  { from: "ready", to: "blocked" },
  { from: "ready", to: "cancelled" },
  { from: "doing", to: "done" },
  { from: "doing", to: "failed" },
  { from: "doing", to: "blocked" },
  { from: "doing", to: "cancelled" },
  { from: "blocked", to: "ready" },
  { from: "blocked", to: "doing" },
  { from: "blocked", to: "cancelled" }
]

/** is from -> to a legal transition? */
export const canTransition = (from: WorkItemState, to: WorkItemState): boolean =>
  TRANSITIONS.some((t) => t.from === from && t.to === to)
