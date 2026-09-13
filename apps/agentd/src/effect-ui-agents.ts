/**
 * Every agent the center knows, and what one of them resolves to.
 *
 * A row leads with the id the center addresses the agent by — an agent has no
 * name of its own — and carries the two revisions the page exists to compare:
 * the one its binding says and the one the agent itself reported. A receipt
 * behind its binding is an agent that has not caught up.
 *
 * The press and its answer stay in this card. Inspect runs for the row it was
 * pressed in, so a row can never load another row's config.
 */
import { failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { badgeCell, badgeOf, boundChip, cell, cellOf, chip, reported, stated, stringEntry } from "./effect-ui-cells.ts"
import { field, listStates, section, table, text } from "./effect-ui-nodes.ts"
import { answer, answered, request, rowRequest } from "./effect-ui-request.ts"

/** The row's one action, run for the agent the row is standing on. */
const inspect: UiNodeSpec = cellOf([rowRequest("Inspect", "agentd.desired", "agentId", "agentId")])

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
  inspect,
]

/**
 * What the agent resolves to. The plan runs for the agent this answer names,
 * and the action that loaded it blanks the previous plan, so the changes below
 * can never be a different agent's.
 */
const desiredAnswer: UiNodeSpec = answer("/inspect/desired/ok", [
  field("Agent", row([boundChip("/inspect/desired/desired/agent/agentId")])),
  answered("Sets", "/inspect/desired/desired/sets", [badgeOf("name")]),
  answered("Artifacts", "/inspect/desired/desired/bundles", [chip("bundleId"), chip("version")]),
  // What it presents at the door, stated and not shown (§F10): the credential
  // itself is declared on Settings, which is the surface that writes it.
  field("MCP Gateway credential", stated({ state: "/inspect/desired/desired/credentialHeld" },
    "held — the door names this agent by it", "none — the door refuses it; declare one in agentd's configuration")),
  row([request("Plan the push", "agentd.plan", "agentId", "/inspect/desired/desired/agent/agentId")]),
])

const planAnswer: UiNodeSpec = answer("/inspect/plan/ok", [
  answered("Changes", "/inspect/plan/changes", [stringEntry()], "Nothing to push: already on this revision."),
])

export const agentsSection: UiNodeSpec = section("Agents", [
  text("Each agent, the machine it runs on, and the revision it is bound to beside the one it reported.", { size: "2", color: "gray" }),
  ...listStates("/status/agents", "No agents are registered."),
  table(["Agent", "Machine", "Kind", "State", "Desired revision", "Applied revision", "Credential", "Inspect"], cells, "/status/agents", "agentId"),
  desiredAnswer,
  planAnswer,
  row([failureBadge("/inspect/desired/error"), failureBadge("/inspect/plan/error")]),
])
