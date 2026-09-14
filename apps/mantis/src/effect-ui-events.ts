/**
 * The event ring: what this host has done lately, and the way to the console's
 * own record of the same thing.
 *
 * An event is not one shape. A message carries text, a log carries a message, a
 * tool step carries a name and the state it reached, an approval carries the call
 * it released — and the ring holds all of them in one list. So the row states the
 * facts it has and stays silent about the ones it does not: an absent field is
 * absent, and the alternative is a column of blanks with one filled cell, which is
 * what a fixed column set over a union of shapes always becomes.
 *
 * The link is here because this app and the host keep two records of one thing
 * (flows §7.3 dead end 5): the ring is this app's own data and belongs on this
 * screen, and the host's Activity place is where every app's events are joined.
 * A reader who has one and needs the other should not have to know the address.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import {
  cellOf, itemTone, keyCell, region, row, rowValue, section, sourceStates, stateBadge, stateRows, table, text, whenRows,
} from "./effect-ui-nodes.ts"
import { toolStateBadges } from "./effect-ui-timeline.ts"

/** A field this kind of event may not carry at all. */
const present = (item: string, node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { item } } })

const detailCells: readonly UiNodeSpec[] = [
  present("text", { component: "Text", props: { size: "1" }, item: "text" }),
  present("message", { component: "Text", props: { size: "1" }, item: "message" }),
  present("detail", { component: "Text", props: { size: "1", color: "gray" }, item: "detail" }),
  present("tool", rowValue("tool", { color: "gray" })),
  ...toolStateBadges,
  itemTone("allow", true, "Allowed", "ok"),
  itemTone("allow", false, "Denied", "denied"),
]

/**
 * The address is the console's own: `#activity?app=mantis` is a place the shell
 * routes, and a declared view reaches it the way any page reaches another — with
 * a link, because nothing in the view language navigates outside the view.
 */
const activityLink: UiNodeSpec = {
  component: "Link",
  props: { href: "#activity?app=mantis", size: "2", value: "Read every event in Activity" },
}

export const eventNodes: readonly UiNodeSpec[] = [
  // the ring holds hundreds of events, and the screen that shows it is one tall
  region([
    section("Recent events", [
      ...sourceStates("events", "No event has been recorded yet. Events appear here as this host runs."),
      whenRows(stateRows("/mantis/events/events"),
        table(["Event", "Conversation", "Detail"],
          [cellOf(stateBadge("type")), keyCell("conversationId"), cellOf(detailCells)],
          { source: { state: "/mantis/events/events" }, key: "ts" })),
      text("The Activity place reads every app's events; this screen is the ring this app kept.", { size: "2", color: "gray" }),
      row([activityLink]),
    ]),
  ]),
]
