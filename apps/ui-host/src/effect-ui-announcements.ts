import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, emptyRows, heading, loadingRows, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { readFailed } from "./effect-ui-sources.ts"

const status: UiNodeSpec = {
  component: "Badge",
  props: { variant: "soft" },
  item: "status",
  visible: { source: { item: "status" } },
}

const announcements = table(["Agent", "Status"], [cell("agent"), cellOf(status)],
  { source: { state: "/activity/events" }, key: "id" })

export const announcementsNodes: readonly UiNodeSpec[] = [
  heading("Announcements", { size: "3" }),
  loadingRows("activity", 3),
  readFailed("activity", "Could not read what the agents announced."),
  emptyRows("activity", "/activity/events",
    "No announcement is recorded. One appears here when an agent announces what it is doing."),
  whenRows(stateRows("/activity/events"), announcements),
]
