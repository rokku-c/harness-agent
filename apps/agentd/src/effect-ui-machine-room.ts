import { NAV_ROOT, field, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer, answered, answeredChip } from "./effect-ui-answer.ts"
import { MACHINE_BINDING, MACHINE_PLAN } from "./effect-ui-paths.ts"
import { pending, readFailed, readFailure, readPending } from "./effect-ui-read.ts"

const binding = `${MACHINE_BINDING}/desired`

const kernel: UiNodeSpec = {
  ...field("Kernel", row([
    { component: "Code", props: { size: "2" }, bind: `${binding}/kernel/bundleId` },
    { component: "Code", props: { size: "2" }, bind: `${binding}/kernel/version` },
  ])),
  visible: { source: { state: `${binding}/kernel` } },
}

const bindingAnswer: UiNodeSpec = answer(`${MACHINE_BINDING}/ok`, [
  answeredChip("Machine", `${binding}/node/machineId`),
  answeredChip("Revision", `${binding}/revision`),
  kernel,
  answered("Placements", `${binding}/apps`, [
    { component: "Code", props: { size: "2" }, item: "bundleId" },
    { component: "Code", props: { size: "2" }, item: "version" },
  ]),
  row([press("Plan the push", "agentd.nodePlan", undefined, { variant: "soft", size: "2" })]),
])

const planAnswer: UiNodeSpec = answer(`${MACHINE_PLAN}/ok`, [
  answered("Changes", `${MACHINE_PLAN}/changes`,
    { component: "Badge", props: { variant: "soft" }, item: "" }, "Nothing to push: already on this revision."),
])

export const machineRoom: readonly UiNodeSpec[] = [
  { component: "Text",
    props: { value: "No machine is open. Open one from the fleet list.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/nodeId` }, not: true } },
  pending(readPending(MACHINE_BINDING)),
  readFailure(readFailed(`${MACHINE_BINDING}/error`), "Could not read this machine.", `${MACHINE_BINDING}/error`, "agentd.node"),
  bindingAnswer,
  readFailure(readFailed(`${MACHINE_PLAN}/error`), "Could not plan this push.", `${MACHINE_PLAN}/error`, "agentd.nodePlan"),
  planAnswer,
]
