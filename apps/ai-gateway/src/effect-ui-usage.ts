/**
 * What the gateway has carried, and the exchanges the figures are counted from.
 *
 * Both come from the model-plane source, so the summary and the list cannot
 * disagree with each other, and the line between them says which is which: the
 * figures count every request ever recorded, the table lists the newest twenty
 * exchanges.
 *
 * A row is an exchange, not an event, and it carries only what every exchange
 * has: who asked and how it ended are written under the request id, because a
 * column that is blank on almost every row is a column of nothing.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, chip, emptyList, row, section, table, text } from "./effect-ui-nodes.ts"

/** One figure: a small grey name over the value the API reports. */
const metric = (name: string, bind: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec => ({
  component: "Card", props: { size: "1" },
  children: [{ component: "Flex", props: { direction: "column", gap: "1" }, children: [
    text(name, { size: "1", color: "gray" }),
    // `bind` is the node's own field, not one of the component's props: spread
    // into props it reaches Radix as a `bind` DOM attribute and the value is lost
    { component: "Text", props: { size: "7", weight: "bold", ...props }, bind },
  ] }],
})

/** The gateway's state in figures, directly under the page's one line of prose. */
export const usageNodes: readonly UiNodeSpec[] = [
  row([
    metric("Requests", "/models/usage/requests"),
    metric("Responses", "/models/usage/responses", { color: "green" }),
    metric("Errors", "/models/usage/errors", { color: "red" }),
    metric("Average duration (ms)", "/models/usage/averageDurationMs"),
  ]),
]

/** What a signal is: present only while the exchange has one. */
const signal = (field: string, color: string): UiNodeSpec =>
  ({ component: "Text", props: { size: "1", color }, item: field, visible: { source: { item: field } } })

const exchangeCells: readonly UiNodeSpec[] = [
  cellOf([chip("requestId"), signal("agent", "gray"), signal("error", "red")]),
  cell("status"),
  cell("durationMs"),
]

/** The exchanges behind the figures above, table-shaped like every other list. */
export const activitySection: UiNodeSpec = section("Recent activity", [
  text("One row per exchange: the request, and the response it got. The twenty newest are listed.", { size: "2", color: "gray" }),
  emptyList("/models/usage/recent", "No requests have been recorded yet."),
  table(["Request", "Status", "Duration (ms)"], exchangeCells, "/models/usage/recent", "requestId"),
])
