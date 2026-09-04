/**
 * Pure model invariants: the work-item state machine and legal transitions.
 */
import { describe, expect, test } from "bun:test"
import { canTransition, WORK_ITEM_STATES, type WorkItemState } from "../src/domain.ts"

const legal: Array<[WorkItemState, WorkItemState]> = [
  ["todo", "ready"], ["todo", "blocked"], ["todo", "cancelled"],
  ["ready", "doing"], ["ready", "blocked"], ["ready", "cancelled"],
  ["doing", "done"], ["doing", "failed"], ["doing", "blocked"], ["doing", "cancelled"],
  ["blocked", "ready"], ["blocked", "doing"], ["blocked", "cancelled"]
]

describe("domain: work item state machine", () => {
  test("every documented transition is legal", () => {
    for (const [from, to] of legal) expect(canTransition(from, to)).toBe(true)
  })
  test("everything else is illegal", () => {
    for (const from of WORK_ITEM_STATES)
      for (const to of WORK_ITEM_STATES)
        if (!legal.some(([f, t]) => f === from && t === to)) expect(canTransition(from, to)).toBe(false)
  })
  test("a done item is terminal (nothing may follow)", () => {
    for (const to of WORK_ITEM_STATES) expect(canTransition("done", to)).toBe(false)
  })
})
