/**
 * The screen one machine is opened on: what its node is bound to run, and what a
 * push would change about it.
 *
 * It is a screen rather than the tail of the machine's row because it is a job —
 * read the binding, plan the push — and it is filled by its own read, run on
 * entry from the id the address carries. So a row's Open and an address pasted
 * into the bar are one arrival, and an address naming no machine makes no call
 * at all rather than asking about a node nobody chose.
 *
 * The plan is the node's own, not the agent's above it in the other room: the
 * two are different answers about different things, kept in different places, so
 * neither screen can read the other's.
 */
import { NAV_ROOT, failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { boundChip, chip, stringEntry } from "./effect-ui-cells.ts"
import { field } from "./effect-ui-nodes.ts"
import { answer, answered, request } from "./effect-ui-request.ts"

/** A node nothing was bound to has no kernel; the row says nothing rather than an empty chip. */
const kernel: UiNodeSpec = {
  ...field("Kernel", row([
    boundChip("/inspect/node/desired/kernel/bundleId"), boundChip("/inspect/node/desired/kernel/version"),
  ])),
  visible: { source: { state: "/inspect/node/desired/kernel" } },
}

/**
 * What the node is asked to run. The plan runs for the node this answer names,
 * and the action that loaded it blanks the previous plan.
 */
const nodeAnswer: UiNodeSpec = answer("/inspect/node/ok", [
  field("Node", row([boundChip("/inspect/node/desired/node/machineId")])),
  kernel,
  answered("Placements", "/inspect/node/desired/apps", [chip("bundleId"), chip("version")]),
  row([request("Plan the push", "agentd.nodePlan", "nodeId", "/inspect/node/desired/node/machineId")]),
])

const planAnswer: UiNodeSpec = answer("/inspect/nodePlan/ok", [
  answered("Changes", "/inspect/nodePlan/changes", [stringEntry()], "Nothing to push: already on this revision."),
])

export const machineRoom: readonly UiNodeSpec[] = [
  { component: "Text", props: { value: "No machine is open. Open one from the list.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/nodeId` }, not: true } },
  nodeAnswer,
  planAnswer,
  row([failureBadge("/inspect/node/error"), failureBadge("/inspect/nodePlan/error")]),
]
