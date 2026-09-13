/**
 * What the gateway decided, newest first. A decision event is read for what was
 * called and what was decided about it, so the row leads with the tool: the
 * call id is the repeat key, and a column of them would be a column of keys.
 *
 * `detail` is not a column. The request event carries none, so half the rows
 * would be blank, and the event that does carry one carries the whole upstream
 * payload or a machine token — neither is a table cell.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStates } from "@effect-agent/effect-ui"
import { cell, cellOf, section, stateBadge, table } from "./effect-ui-nodes.ts"

/**
 * The event's type is always there; a decision is only there on the events that
 * made one, so the request rows show the type alone rather than an empty pill.
 */
const decision: UiNodeSpec = { ...stateBadge("decision"), visible: { source: { item: "decision" } } }

export const auditSection: UiNodeSpec = section("Recent decisions", [
  ...sourceStates("audit", "No decisions recorded yet."),
  table(["Tool", "Type", "Decision"], [cell("tool"), cellOf(stateBadge("type")), cellOf(decision)],
    { source: { state: "/audit/events" }, key: "callId" }),
])
