/**
 * Every fleet agent the center knows: the two revisions this console exists to
 * compare, the machine each runs on, and the one move an operator makes from a
 * row.
 *
 * A row leads with the id the center addresses the agent by. An agent has no
 * name of its own, so there is nothing to put above it and nothing to read it
 * as; the identity column is the key itself, in mono, which is what the operator
 * correlates against a log.
 *
 * A row's Open enters the agent's own screen and does nothing else. What fills
 * that screen is the screen's own read, so a row and an address pasted into the
 * bar are one arrival with one read behind both, and no answer about one agent
 * is ever written under the list of all of them.
 */
import { emptyRows, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { AGENTS, STATUS_SOURCE } from "./effect-ui-paths.ts"
import { cellOf, chip, figure, rowPress, stated, table, block } from "./effect-ui-rows.ts"
import { reading } from "./effect-ui-read.ts"
import { infoOf } from "./effect-ui-tone.ts"

/** A badge for one of several spelled states, with no colour: an enumeration has no worse member. */
const state: UiNodeSpec = cellOf([{ component: "Badge", props: { variant: "soft" }, item: "status" }])

/**
 * What the agent presents at the MCP Gateway's door, stated and never shown.
 * The value of the credential is not read on this surface at all, only whether
 * one is held, which is the same question the door resolves when the agent calls
 * it. Plain words: nothing here is a verdict the console may tone without
 * inventing one from a boolean.
 */
const credential: UiNodeSpec = cellOf(stated({ item: "desired/credentialHeld" }, "Held", "Not held"))

const headings = [
  "Fleet agent", "Machine", "Kind", "State", "Desired revision", "Applied revision", "Credential", "Open",
]

const cells: readonly UiNodeSpec[] = [
  cellOf([chip("agentId")]),
  cellOf([chip("machineId")]),
  cellOf([infoOf("kind")]),
  state,
  figure("desired/revision", "desired", "not bound"),
  figure("applied/revision", "applied", "not reported"),
  credential,
  rowPress("Open", "agentd.openAgent", "agentId", "agentId"),
]

export const agentsBlock: UiNodeSpec = block(
  "Fleet agents",
  "Each fleet agent, the machine it runs on, and the revision it is bound to beside the one it reported.",
  [
    reading(STATUS_SOURCE, headings.length),
    emptyRows(STATUS_SOURCE, AGENTS, "No fleet agent is declared. agentd's configuration names the fleet, so an agent appears here once one is added there."),
    whenRows(stateRows(AGENTS), table(headings, cells, { source: { state: AGENTS }, key: "agentId" })),
  ],
)
