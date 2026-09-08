import { expect, test } from "bun:test"
import { describeConfigState } from "../config-state.ts"

test("apply affordance and status are derived from saved server state, not clicked strategy", () => {
  expect(describeConfigState({ ok: true, pendingRestart: true, revision: 2 })).toMatchObject({
    tone: "pending", canApply: true, revision: "revision 2",
  })
  expect(describeConfigState({ ok: true, pendingRestart: false, revision: 3 })).toMatchObject({
    tone: "active", canApply: false, revision: "revision 3",
  })
  expect(describeConfigState({ ok: false, pendingRestart: true })).toMatchObject({ tone: "error", canApply: true })
})
