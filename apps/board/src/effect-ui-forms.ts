/**
 * The two editable records on the board: a task being created, and the task
 * opened from a row. Both are the same fields, so both build from the same
 * builders; the paths and the buttons differ.
 *
 * Each is a screen of its own, and that is what makes the last line below true
 * rather than hopeful: a write's failure lands on the screen that issued it, and
 * the fields it was made from are on that same screen, above it. Two records
 * reading one result path would show each other's errors, and a failure shown
 * against the wrong record is worse than no message at all.
 *
 * The opened record stays on screen after a successful delete. A result path is
 * *replaced* by the write that wrote it, so pointing delete at `/selected` would
 * wipe the record on a failed delete — the one case where the operator needs it
 * still there to retry.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, memo, picker, refusal, withOutcome } from "./effect-ui-fields.ts"

export const createFields: readonly UiNodeSpec[] = [
  entry("Title", "/create/title"),
  memo("Body", "/create/body"),
  picker("/create/state"),
  refusal("/createResult"),
  withOutcome([
    { component: "Button", props: { value: "Create task" }, onPress: "board.create",
      params: { title: { state: "/create/title" }, body: { state: "/create/body" }, state: { state: "/create/state" } } },
  ], "/createResult", [["/createResult/id", "Created"]]),
]

/** Saving sends every field on screen: a partial merge that holds one back is the form disagreeing with the record. */
export const selectedFields: readonly UiNodeSpec[] = [
  refusal("/selected"),
  { component: "Text", props: { value: "No task is open. Pick one from the board.", size: "2", color: "gray" },
    visible: { source: { state: "/selected/id" }, not: true } },
  { component: "Flex", props: { direction: "column", gap: "3" },
    visible: { source: { state: "/selected/id" } },
    children: [
      entry("Title", "/selected/title"),
      memo("Body", "/selected/body"),
      picker("/selected/state"),
      withOutcome([
        { component: "Button", props: { value: "Save task" }, onPress: "board.save",
          params: { taskId: { state: "/selected/id" }, title: { state: "/selected/title" },
            body: { state: "/selected/body" }, state: { state: "/selected/state" } } },
        { component: "Button", props: { value: "Delete task", variant: "soft", color: "red" }, onPress: "board.delete",
          params: { taskId: { state: "/selected/id" } } },
      ], "/selectedResult", [["/selectedResult/id", "Saved"], ["/selectedResult/ok", "Deleted"]]),
    ] },
]
