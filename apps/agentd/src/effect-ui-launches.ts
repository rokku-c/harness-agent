/**
 * The launch queue: every intent asked of a machine, and what became of it.
 *
 * It is a screen rather than a block on the fleet because it is a destination
 * rather than a fact about the fleet: an intent is queued, the operator who
 * queued it comes back to read what became of it, and the fleet screen is where
 * you look at machines rather than at work.
 *
 * It carries its own read states, because its read feeds this one list and
 * nothing else: the fleet's failure notice belongs to a different read and could
 * not stand for this one.
 *
 * A launch with no identity is stated rather than left blank. Work that is not a
 * turn names its own machine and its own argv and has no fleet agent behind it,
 * so a cell reading "a command" is the true answer, while an empty cell would
 * read as a column the read did not carry.
 */
import { emptyRows, sourceStatusPath, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { LAUNCHES, LAUNCHES_SOURCE } from "./effect-ui-paths.ts"
import { readFailure, reading, sourceFailed } from "./effect-ui-read.ts"
import { cellOf, chip, screenHead, table } from "./effect-ui-rows.ts"
import { pending } from "./effect-ui-tone.ts"

/**
 * The states an intent is still in a machine's hands during. Guarded on those
 * three rather than on the result field being empty: a machine that reported
 * "done" without a note has an outcome in an empty cell, and an unanswered step
 * is a different fact.
 */
const IN_FLIGHT = ["queued", "claimed", "running"]
const inFlight: UiNodeSpec["visible"] =
  ({ any: IN_FLIGHT.map((state) => ({ source: { item: "state" }, equals: state })) })

const agent: UiNodeSpec = cellOf([
  chip("agentId"),
  { component: "Text", props: { value: "a command", size: "2", color: "gray" },
    visible: { source: { item: "agentId" }, not: true } },
])

const headings = ["Fleet agent", "Machine", "State", "Result"]

const cells: readonly UiNodeSpec[] = [
  agent,
  cellOf([chip("machineId")]),
  cellOf([{ component: "Badge", props: { variant: "soft" }, item: "state" }]),
  cellOf([
    { component: "Text", props: { size: "2" }, item: "detail" },
    { ...pending("Pending"), visible: inFlight },
  ]),
]

export const launchesScreen: readonly UiNodeSpec[] = [
  screenHead("Launches", "Every intent asked of a machine, and what became of it."),
  reading(LAUNCHES_SOURCE, headings.length, 4),
  readFailure(sourceFailed(LAUNCHES_SOURCE), "Could not read the launch queue.",
    `${sourceStatusPath(LAUNCHES_SOURCE)}/error`, "agentd.retryLaunches"),
  emptyRows(LAUNCHES_SOURCE, LAUNCHES,
    "No launch has been asked of a machine. Requests appear here when an agent asks for one."),
  whenRows(stateRows(LAUNCHES), table(headings, cells, { source: { state: LAUNCHES }, key: "intentId" })),
]
