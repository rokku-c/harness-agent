/**
 * What the agents using this canvas announced, newest first.
 *
 * The writer is the agent itself — the runtime's `ui_set_status` surface names
 * the agent a status belongs to — so no control here writes one: an operator
 * signing a record in someone else's name is not a task this screen has.
 *
 * A status is free text an agent chose, so it carries no tone. A colour picked
 * out of a string the console did not write would be a verdict this screen
 * invented, which is the one thing the design system forbids a declared view to
 * do (design-system §3.5).
 *
 * An empty status is how an agent says it has nothing current, so the chip is
 * guarded rather than blank: a blank pill in the column reads as a row whose
 * read failed, which is a different thing from an agent that is idle.
 */
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
