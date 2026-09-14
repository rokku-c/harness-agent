/**
 * The exchanges the figures above are counted from.
 *
 * A row is an exchange — a request and everything recorded under its id — and
 * not one row per event. Read as events the newest twenty alternate between
 * requests and answers and say nothing about either; the audit is a log, and an
 * exchange is the thing that happened.
 *
 * The outcome is a column rather than two, because the three states a row can
 * be in are one fact: answered, failed, or not answered yet. Stated separately,
 * two of the three leave a cell empty, and an empty cell in a column of
 * statuses reads as a status that failed to load.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip } from "@effect-agent/effect-ui"
import { mono, note, listRows } from "./effect-ui-nodes.ts"

const RECENT = "/models/usage/recent"

/** What the exchange was, and who asked. The agent is often not recorded, and a
 *  column that is blank on most rows is a column of nothing. */
const request: UiNodeSpec = cellOf([
  chip("requestId"),
  { component: "Text", props: { size: "1", color: "gray" }, item: "agent", visible: { source: { item: "agent" } } },
])

/** A status code is a reading, not a name, so it is mono and lines up down the column. */
const status: UiNodeSpec = { ...mono("status"), visible: { source: { item: "status" } } }

/**
 * The request arrived and nothing has come back yet — a step in flight, which
 * is a pending tone and not a failure. Two fields have to be empty at once, and
 * the language states an "and" by nesting one guard inside the other: without
 * the outer one, an exchange that failed before any status was recorded would
 * be labelled as still waiting, and the red word beside it would contradict it.
 */
const waiting: UiNodeSpec = {
  component: "Flex",
  visible: { source: { item: "status" }, not: true },
  children: [{
    component: "Badge", props: { variant: "soft", color: "amber", highContrast: true, value: "No answer yet" },
    visible: { source: { item: "error" }, not: true },
  }],
}

/** The failure, in the tone the design system gives a failure: the word first,
 *  then the reason in its own place under it. */
const failed: readonly UiNodeSpec[] = [
  { component: "Badge", props: { variant: "soft", color: "red", highContrast: true, value: "Failed" },
    visible: { source: { item: "error" } } },
  { component: "Text", props: { size: "1", color: "red", highContrast: true }, item: "error",
    visible: { source: { item: "error" } } },
]

const outcome: UiNodeSpec = cellOf([
  { component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [status, waiting, ...failed] },
])

/** A duration the recorder did not measure is said to be missing: a blank cell
 *  in a column of numbers reads as a number the console lost. */
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
