import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip } from "@effect-agent/effect-ui"
import { mono, note, listRows } from "./effect-ui-nodes.ts"

const RECENT = "/models/usage/recent"

const request: UiNodeSpec = cellOf([
  chip("requestId"),
  { component: "Text", props: { size: "1", color: "gray" }, item: "agent", visible: { source: { item: "agent" } } },
])

const status: UiNodeSpec = { ...mono("status"), visible: { source: { item: "status" } } }

const waiting: UiNodeSpec = {
  component: "Flex",
  visible: { source: { item: "status" }, not: true },
  children: [{
    component: "Badge", props: { variant: "soft", color: "amber", highContrast: true, value: "No answer yet" },
    visible: { source: { item: "error" }, not: true },
  }],
}

const failed: readonly UiNodeSpec[] = [
  { component: "Badge", props: { variant: "soft", color: "red", highContrast: true, value: "Failed" },
    visible: { source: { item: "error" } } },
  { component: "Text", props: { size: "1", color: "red", highContrast: true }, item: "error",
    visible: { source: { item: "error" } } },
]

const outcome: UiNodeSpec = cellOf([
  { component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [status, waiting, ...failed] },
])

const duration: UiNodeSpec = cellOf([
  { ...mono("durationMs"), visible: { source: { item: "durationMs" } } },
  { component: "Text", props: { value: "Not measured", size: "2", color: "gray" },
    visible: { source: { item: "durationMs" }, not: true } },
])

export const exchangesSection: readonly UiNodeSpec[] = [
  note("One row per exchange: the request, and the answer it got. The twenty newest are listed."),
  ...listRows(["Request", "Outcome", "Duration (ms)"], [request, outcome, duration], RECENT,
    "No exchange has been recorded yet. Traffic appears here as the proxy serves it.", "requestId"),
]
