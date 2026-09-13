/**
 * Every agent the center knows: the two revisions this console exists to
 * compare, the machine each runs on, and the one move an operator makes from a
 * row.
 *
 * A row leads with the id the center addresses the agent by — an agent has no
 * name of its own — and carries the revision its binding says beside the one the
 * agent itself reported. A receipt behind its binding is an agent that has not
 * caught up.
 *
 * Open enters the agent's own screen and nothing else: what fills that screen is
 * the screen's business (`effect-ui-agent-room.ts`), so a row and a link pasted
 * into the bar are the same arrival with one read behind both, and the list is
 * never the place an answer about one agent lands.
 */
import { emptyRows, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { badgeCell, badgeOf, cell, cellOf, chip, reported, stated } from "./effect-ui-cells.ts"
import { STATUS_SOURCE, section, table, text } from "./effect-ui-nodes.ts"
import { rowRequest } from "./effect-ui-request.ts"

/** The row's one action, run for the agent the row is standing on. */
const open: UiNodeSpec = cellOf([rowRequest("Open", "agentd.openAgent", "agentId", "agentId")])

const cells: readonly UiNodeSpec[] = [
  cellOf([chip("agentId")]),
  cellOf([chip("machineId")]),
  cell("kind"),
  badgeCell("status"),
  cell("desired/revision"),
  reported("applied/revision"),
  // The door refuses an agent that presents nothing, so which agents are in
  // that state is a column of the fleet rather than a footnote to one row.
  cellOf([stated({ item: "desired/credentialHeld" }, "held", "none")]),
  open,
]

export const agentsSection: UiNodeSpec = section("Agents", [
  text("Each agent, the machine it runs on, and the revision it is bound to beside the one it reported.", { size: "2", color: "gray" }),
  emptyRows(STATUS_SOURCE, "/status/agents", "No agents are registered."),
  whenRows(stateRows("/status/agents"), table([
    "Agent", "Machine", "Kind", "State", "Desired revision", "Applied revision", "Credential", "Open",
  ], cells, "/status/agents", "agentId")),
])
