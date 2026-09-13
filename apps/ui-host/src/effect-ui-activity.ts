import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStates } from "@effect-agent/effect-ui"
import { cell, cellOf, section, table } from "./effect-ui-nodes.ts"

/**
 * A status chip, present only while there is a status to carry. An empty status
 * is how an agent announces it is done, and a chip rendered for it is a blank
 * pill in the column — the log then reads as a row that failed to load rather
 * than as an agent with nothing current.
 */
const statusCell = (item: string): UiNodeSpec =>
  cellOf({ component: "Badge", props: { variant: "soft" }, item, visible: { source: { item } } })

/**
 * What the agents using this canvas announced. The card is a record, and the
 * shape says so: the verdicts of the source that carries it, then the rows.
 *
 * The writer of an announcement is the agent itself — the runtime's
 * `ui_set_status` surface names the agent a status belongs to — so the field
 * pair and press that used to lead this card were an operator signing a record
 * in someone else's name, and the card opened on two blanks under a title that
 * promised a log. Writing a status is not a task this page has.
 *
 * The store also serves per-agent current statuses, and no node reads them: a
 * repeat source is an array, and a record of agent → status is not one. The
 * newest event per agent is the same fact, and the table below leads with it.
 */
export const activitySection: UiNodeSpec = section("Activity", [
  ...sourceStates("activity", "No activity has been recorded yet."),
  table(["Agent", "Status"], [cell("agent"), statusCell("status")], { source: { state: "/activity/events" }, key: "id" }),
])
