/**
 * The event ring: what this console has done lately, as rows. It is a log, so a
 * row leads with the kind of event rather than with its timestamp.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStates, stateRows, whenRows } from "@effect-agent/effect-ui"
import { cell, cellOf, section, stateBadge, table } from "./effect-ui-nodes.ts"

export const eventNodes: readonly UiNodeSpec[] = [
  section("Recent events", [
    ...sourceStates("events", "No events have been recorded yet."),
    whenRows(stateRows("/mantis/events/events"),
      table(["Event", "Text"], [cellOf(stateBadge("type")), cell("text")],
        { source: { state: "/mantis/events/events" }, key: "ts" })),
  ]),
]
