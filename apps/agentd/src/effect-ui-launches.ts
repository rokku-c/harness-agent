import { emptyRows, sourceStatusPath, stateRows, toneBadge, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { LAUNCHES, LAUNCHES_SOURCE } from "./effect-ui-paths.ts"
import { readFailure, reading, sourceFailed } from "./effect-ui-read.ts"
import { cellOf, chip, screenHead, table } from "./effect-ui-rows.ts"

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
    { ...toneBadge("pending", "Pending"), visible: inFlight },
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
