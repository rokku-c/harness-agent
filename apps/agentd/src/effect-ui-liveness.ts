import { row, stateRows, toneBadge, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { NODES } from "./effect-ui-paths.ts"
import { block, cellOf, chip, table } from "./effect-ui-rows.ts"

const presence: UiNodeSpec = cellOf([row([
  { ...toneBadge("ok", "Online"), visible: { source: { item: "online" }, equals: true } },
  { ...toneBadge("failed", "Offline"), visible: { source: { item: "online" }, not: true } },
])])

const cells: readonly UiNodeSpec[] = [
  cellOf([chip("nodeId")]),
  presence,
  cellOf([row([
    { ...toneBadge("info", "Withdrawn"), visible: { source: { item: "withdrawn" }, equals: true } },
    { component: "Text", props: { value: "No", size: "2", color: "gray" },
      visible: { source: { item: "withdrawn" }, not: true } },
  ])]),
]

const liveness: UiNodeSpec = block(
  "Liveness",
  "What the server has observed rather than what a machine claims: a lease is renewed, or it lapses.",
  [
    table(["Node", "Presence", "Withdrawn"], cells, { source: { state: NODES }, key: "nodeId" }),
  ],
)

export const livenessBlock: UiNodeSpec = whenRows(stateRows(NODES), liveness)
