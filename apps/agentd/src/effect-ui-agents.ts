import { emptyRows, stateRows, toneField, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { AGENTS, STATUS_SOURCE } from "./effect-ui-paths.ts"
import { cellOf, chip, figure, rowPress, stated, table, block } from "./effect-ui-rows.ts"
import { reading } from "./effect-ui-read.ts"

const state: UiNodeSpec = cellOf([{ component: "Badge", props: { variant: "soft" }, item: "status" }])

const credential: UiNodeSpec = cellOf(stated({ item: "desired/credentialHeld" }, "Held", "Not held"))

const headings = [
  "Fleet agent", "Machine", "Kind", "State", "Desired revision", "Applied revision", "Credential", "Open",
]

const cells: readonly UiNodeSpec[] = [
  cellOf([chip("agentId")]),
  cellOf([chip("machineId")]),
  cellOf([toneField("info", "kind")]),
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
