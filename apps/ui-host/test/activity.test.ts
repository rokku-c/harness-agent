import { expect, test } from "bun:test"
import { makeActivityStore } from "../src/activity.ts"

test("tracks current agent status and bounded activity", () => {
  const activity = makeActivityStore()
  activity.setStatus("Codex", "Building")
  expect(activity.statuses()).toEqual({ Codex: "Building" })
  activity.setStatus("Codex", "")
  expect(activity.statuses()).toEqual({})
  expect(activity.list()).toHaveLength(2)
})
