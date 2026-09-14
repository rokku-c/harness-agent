import { heading, NAV_ROOT, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, memo, picker, refusal } from "./effect-ui-fields.ts"
import { outcome } from "./effect-ui-outcome.ts"

const nothingOpen: UiNodeSpec = {
  component: "Text",
  props: { value: "No task is open. Pick one from the board.", size: "2", color: "gray" },
  visible: { source: { state: `${NAV_ROOT}/taskId` }, not: true },
}

const record: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: { source: { state: "/selected/id" } },
  children: [
    entry("Title", "/selected/title"),
    memo("Body", "/selected/body"),
    picker("/selected/state"),
    outcome([
      press("Save task", "board.save", {
        taskId: { state: "/selected/id" },
        title: { state: "/selected/title" },
        body: { state: "/selected/body" },
        state: { state: "/selected/state" },
      }, { variant: "solid" }),
      press("Delete task", "board.delete", { taskId: { state: "/selected/id" } }, { variant: "soft", color: "red" }),
    ], [["/selectedResult/id", "Saved"], ["/selectedResult/ok", "Deleted"]]),
  ],
}

const retryRead: UiNodeSpec = row([
  { ...press("Try again", "board.load", undefined, { variant: "soft", size: "1" }),
    visible: { source: { state: "/selected/error" } } },
])

export const taskScreen: readonly UiNodeSpec[] = [
  heading("Task", { size: "4" }),
  refusal("/selected/error"),
  retryRead,
  nothingOpen,
  record,
]
