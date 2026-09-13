/**
 * Every machine the center knows, and what one of them is asked to run.
 *
 * A row leads with the machine's name over the id the center addresses it by,
 * and carries the state the machine reports about itself beside the two
 * revisions it is under: the one its binding says and the one it reported back.
 * A node behind its binding reads as one number next to another.
 *
 * What the *server* has observed is not here and cannot be: a machine's `status`
 * is a word someone chose and it keeps claiming `"online"` after the process
 * behind it dies, so the leases are a list of their own below.
 *
 * The press and its answer stay in this card, exactly as in the agents above.
 */
import { failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { badgeCell, boundChip, cell, cellOf, chip, identity, reported, stringEntry } from "./effect-ui-cells.ts"
import { field, listStates, section, table, text } from "./effect-ui-nodes.ts"
import { answer, answered, request, rowRequest } from "./effect-ui-request.ts"

const cells: readonly UiNodeSpec[] = [
  identity("name", "machineId"),
  badgeCell("status"),
  cell("desired/revision"),
  reported("applied/revision"),
  cellOf([rowRequest("Inspect", "agentd.node", "nodeId", "machineId")]),
]

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

export const machinesSection: UiNodeSpec = section("Machines", [
  text("Each machine, the state it reports, and the revision it is bound to beside the one it reported.", { size: "2", color: "gray" }),
  ...listStates("/status/machines", "No machines are registered."),
  table(["Machine", "State", "Desired revision", "Applied revision", "Inspect"], cells, "/status/machines", "machineId"),
  nodeAnswer,
  planAnswer,
  row([failureBadge("/inspect/node/error"), failureBadge("/inspect/nodePlan/error")]),
])
