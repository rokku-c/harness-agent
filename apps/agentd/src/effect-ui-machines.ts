/**
 * Every machine the center knows: the state each reports about itself, and what
 * one of them is asked to run.
 *
 * A row leads with the machine's name over the id the center addresses it by,
 * and carries the state the machine reports beside the two revisions it is under:
 * the one its binding says and the one it reported back. A node behind its
 * binding reads as one number next to another.
 *
 * What the *server* has observed is not here and cannot be: a machine's `status`
 * is a word someone chose and it keeps claiming `"online"` after the process
 * behind it dies, so the leases are a list of their own beside this one.
 *
 * Open is the same gesture under the same word as the agents' above, because
 * both rows open the thing the row stands on rather than answering a question
 * about it — and it enters a screen, so the answer about one machine is never
 * written under the list of all of them.
 */
import { emptyRows, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { badgeCell, boundChip, cell, cellOf, chip, identity, reported } from "./effect-ui-cells.ts"
import { STATUS_SOURCE, section, table, text } from "./effect-ui-nodes.ts"
import { rowRequest } from "./effect-ui-request.ts"

const cells: readonly UiNodeSpec[] = [
  identity("name", "machineId"),
  badgeCell("status"),
  cell("desired/revision"),
  reported("applied/revision"),
  cellOf([rowRequest("Open", "agentd.openMachine", "nodeId", "machineId")]),
]

export const machinesSection: UiNodeSpec = section("Machines", [
  text("Each machine, the state it reports, and the revision it is bound to beside the one it reported.", { size: "2", color: "gray" }),
  emptyRows(STATUS_SOURCE, "/status/machines", "No machines are registered."),
  whenRows(stateRows("/status/machines"), table([
    "Machine", "State", "Desired revision", "Applied revision", "Open",
  ], cells, "/status/machines", "machineId")),
])
