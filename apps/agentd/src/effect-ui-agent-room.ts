/**
 * The screen one fleet agent is opened on: what it resolves to, what a push
 * would change about it, and the turn it can be asked for.
 *
 * It is a screen rather than the tail of the agent's row because working an
 * agent is a job (read what it is bound to, plan the push, ask for the turn),
 * and a job is entered and come back from, past a fleet that grows with every
 * machine that joins it.
 *
 * What fills it is the screen's own read, run on entry from the id the address
 * carries, so a row's Open and an address pasted into the bar are one arrival
 * with one read behind both. That read names the agent in its path, so an
 * address naming none makes no call at all rather than asking about an agent
 * nobody chose. What the screen says then is read from the address and not from
 * the answer, because the answer is absent both while the read is in flight and
 * for good once it has failed.
 *
 * The plan runs for the agent the *address* names rather than the one this
 * answer happens to describe. That is what makes the plan reproducible: an
 * address carries the id, so the press that plans a push after a link is pasted
 * is planning the same agent's push. An answer is a record of one moment, and a
 * plan computed from it would be a plan for whatever was on screen at the time.
 */
import { NAV_ROOT, field, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer, answered, answeredChip } from "./effect-ui-answer.ts"
import { launchForm } from "./effect-ui-launch-form.ts"
import { AGENT_PLAN, AGENT_RESOLUTION } from "./effect-ui-paths.ts"
import { pending, readFailed, readFailure, readPending } from "./effect-ui-read.ts"
import { cellOf, stated } from "./effect-ui-rows.ts"

const resolution = `${AGENT_RESOLUTION}/desired`

/** What the agent resolves to, and the one thing that can be asked of it. */
const resolutionAnswer: UiNodeSpec = answer(`${AGENT_RESOLUTION}/ok`, [
  answeredChip("Fleet agent", `${resolution}/agent/agentId`),
  answeredChip("Machine", `${resolution}/agent/machineId`),
  answeredChip("Revision", `${resolution}/revision`),
  answered("Sets", `${resolution}/sets`, { component: "Badge", props: { variant: "soft" }, item: "name" }),
  answered("Artifacts", `${resolution}/bundles`, [
    { component: "Code", props: { size: "2" }, item: "bundleId" },
    { component: "Code", props: { size: "2" }, item: "version" },
  ]),
  // Stated and not shown: what an operator reads here is which agents the MCP
  // Gateway's door will refuse, and that is a word rather than a string of
  // characters. The value itself is written where it is declared, on Settings.
  field("MCP Gateway credential", row(stated({ state: `${resolution}/credentialHeld` }, "Held", "Not held"))),
  row([press("Plan the push", "agentd.plan", undefined, { variant: "soft", size: "2" })]),
  ...launchForm,
])

/** What a push would change, and nothing when there is nothing to change. */
const planAnswer: UiNodeSpec = answer(`${AGENT_PLAN}/ok`, [
  answered("Changes", `${AGENT_PLAN}/changes`,
    { component: "Badge", props: { variant: "soft" }, item: "" }, "Nothing to push: already on this revision."),
])

export const agentRoom: readonly UiNodeSpec[] = [
  { component: "Text",
    props: { value: "No fleet agent is open. Open one from the fleet list.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/agentId` }, not: true } },
  pending(readPending(AGENT_RESOLUTION)),
  readFailure(readFailed(`${AGENT_RESOLUTION}/error`), "Could not read this fleet agent.", `${AGENT_RESOLUTION}/error`, "agentd.desired"),
  resolutionAnswer,
  readFailure(readFailed(`${AGENT_PLAN}/error`), "Could not plan this push.", `${AGENT_PLAN}/error`, "agentd.plan"),
  planAnswer,
]
