/**
 * The screen one agent is opened on: what it resolves to, what a push would
 * change, and the turn it can be asked for.
 *
 * It is a screen rather than the tail of the agent's row because working an
 * agent is a job — read what it is bound to, plan the push, ask for the turn —
 * and a job is entered and come back from (Journey 3, `docs/flows.md`), past a
 * fleet that grows with every machine that joins it.
 *
 * What fills it is the screen's own read, run on entry from the id the address
 * carries, so a row's Open and an address pasted into the bar are one arrival.
 * That read names the agent in its path, so an address naming none makes no call
 * at all rather than asking about an agent nobody chose — and what the screen
 * says then is read from the address and not from the answer: the answer is
 * absent while the read is in flight, and again for good when it failed.
 */
import { NAV_ROOT, failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { badgeOf, boundChip, chip, stated, stringEntry } from "./effect-ui-cells.ts"
import { launchForm } from "./effect-ui-launch.ts"
import { field } from "./effect-ui-nodes.ts"
import { answer, answered, request } from "./effect-ui-request.ts"

/**
 * What the agent resolves to, and the one thing that can be asked of it. The
 * plan runs for the agent this answer names, and the action that loaded it
 * blanks the previous plan and the previous launch, so neither the changes below
 * nor the turn below them can be a different agent's.
 */
const desiredAnswer: UiNodeSpec = answer("/inspect/desired/ok", [
  field("Agent", row([boundChip("/inspect/desired/desired/agent/agentId")])),
  answered("Sets", "/inspect/desired/desired/sets", [badgeOf("name")]),
  answered("Artifacts", "/inspect/desired/desired/bundles", [chip("bundleId"), chip("version")]),
  // What it presents at the door, stated and not shown (§F10): the credential
  // itself is declared on Settings, which is the surface that writes it.
  field("MCP Gateway credential", stated({ state: "/inspect/desired/desired/credentialHeld" },
    "held: the door names this agent by it", "none: the door refuses it; declare one in agentd's configuration")),
  row([request("Plan the push", "agentd.plan", "agentId", "/inspect/desired/desired/agent/agentId")]),
  ...launchForm,
])

const planAnswer: UiNodeSpec = answer("/inspect/plan/ok", [
  answered("Changes", "/inspect/plan/changes", [stringEntry()], "Nothing to push: already on this revision."),
])

export const agentRoom: readonly UiNodeSpec[] = [
  { component: "Text", props: { value: "No agent is open. Open one from the list.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/agentId` }, not: true } },
  desiredAnswer,
  planAnswer,
  row([failureBadge("/inspect/desired/error"), failureBadge("/inspect/plan/error")]),
]
