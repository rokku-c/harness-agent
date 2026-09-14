import { NAV_ROOT, field, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer, answered, answeredChip } from "./effect-ui-answer.ts"
import { launchForm } from "./effect-ui-launch-form.ts"
import { AGENT_PLAN, AGENT_RESOLUTION } from "./effect-ui-paths.ts"
import { pending, readFailed, readFailure, readPending } from "./effect-ui-read.ts"
import { cellOf, stated } from "./effect-ui-rows.ts"

const resolution = `${AGENT_RESOLUTION}/desired`

const resolutionAnswer: UiNodeSpec = answer(`${AGENT_RESOLUTION}/ok`, [
  answeredChip("Fleet agent", `${resolution}/agent/agentId`),
  answeredChip("Machine", `${resolution}/agent/machineId`),
  answeredChip("Revision", `${resolution}/revision`),
  answered("Sets", `${resolution}/sets`, { component: "Badge", props: { variant: "soft" }, item: "name" }),
  answered("Artifacts", `${resolution}/bundles`, [
    { component: "Code", props: { size: "2" }, item: "bundleId" },
    { component: "Code", props: { size: "2" }, item: "version" },
  ]),
  field("MCP Gateway credential", row(stated({ state: `${resolution}/credentialHeld` }, "Held", "Not held"))),
  row([press("Plan the push", "agentd.plan", undefined, { variant: "soft", size: "2" })]),
  ...launchForm,
])

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
