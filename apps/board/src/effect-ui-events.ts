import { cellOf, heading, row, sourceStates, stateRows, table, text, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"

const activityLink: UiNodeSpec = {
  component: "Link",
  props: { href: "#activity?app=board", size: "1", value: "Activity" },
}

const eventCells: readonly UiNodeSpec[] = [
  cellOf({ component: "Code", props: { size: "1" }, item: "seq" }),
  cellOf({ component: "Text", props: { size: "2", weight: "medium" }, item: "kind" }),
  cellOf({ component: "Code", props: { size: "1" }, item: "taskId" }),
  cellOf(row([activityLink])),
]

export const eventScreen: readonly UiNodeSpec[] = [
  heading("Events", { size: "4" }),
  text("What the board has done lately. Activity reads every app's events and filters them by place.",
    { size: "2", color: "gray" }),
  ...sourceStates("events", "No event has been recorded yet. Events appear here as the board runs."),
  whenRows(stateRows("/events/events"),
    table(["#", "Event", "Subject", ""], eventCells,
      { source: { state: "/events/events" }, key: "seq" })),
]
