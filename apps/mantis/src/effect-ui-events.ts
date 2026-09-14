import { toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import {
  cellOf, keyCell, region, row, rowValue, section, sourceStates, stateBadge, stateRows, table, text, whenRows,
} from "./effect-ui-nodes.ts"
import { toolStateBadges } from "./effect-ui-timeline.ts"

const present = (item: string, node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { item } } })

const detailCells: readonly UiNodeSpec[] = [
  present("text", { component: "Text", props: { size: "1" }, item: "text" }),
  present("message", { component: "Text", props: { size: "1" }, item: "message" }),
  present("detail", { component: "Text", props: { size: "1", color: "gray" }, item: "detail" }),
  present("tool", rowValue("tool", { color: "gray" })),
  ...toolStateBadges,
  { ...toneBadge("ok", "Allowed"), visible: { source: { item: "allow" }, equals: true } },
  { ...toneBadge("denied", "Denied"), visible: { source: { item: "allow" }, equals: false } },
]

const activityLink: UiNodeSpec = {
  component: "Link",
  props: { href: "#activity?app=mantis", size: "2", value: "Read every event in Activity" },
}

export const eventNodes: readonly UiNodeSpec[] = [
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
