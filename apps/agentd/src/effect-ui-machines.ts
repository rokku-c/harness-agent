/**
 * Every machine the center knows: the state the machine claims about itself,
 * and the two revisions it is under.
 *
 * What the *server* has observed is not in this table and cannot be: a machine's
 * `status` is a word someone chose and it keeps claiming `online` after the
 * process behind it dies. The observation is the liveness list beside this one,
 * which is derived from leases the server renews itself, and keeping them apart
 * is what stops a claim and a fact from becoming one cell.
 *
 * A machine has a name of its own, so the name leads the row and the id the
 * center addresses it by sits under it as the key it is.
 */
import { emptyRows, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { MACHINES, STATUS_SOURCE } from "./effect-ui-paths.ts"
import { block, cellOf, figure, identity, rowPress, table } from "./effect-ui-rows.ts"
import { reading } from "./effect-ui-read.ts"

const headings = ["Machine", "State", "Desired revision", "Applied revision", "Open"]

const cells: readonly UiNodeSpec[] = [
  identity("name", "machineId"),
  cellOf([{ component: "Badge", props: { variant: "soft" }, item: "status" }]),
  figure("desired/revision", "desired", "not bound"),
  figure("applied/revision", "applied", "not reported"),
  rowPress("Open", "agentd.openMachine", "nodeId", "machineId"),
]

export const machinesBlock: UiNodeSpec = block(
  "Machines",
  "Each machine, the state it claims, and the revision it is bound to beside the one it reported.",
  [
    reading(STATUS_SOURCE, headings.length),
    emptyRows(STATUS_SOURCE, MACHINES, "No machine is declared. A machine appears here once it announces itself, or once agentd's configuration names one."),
    whenRows(stateRows(MACHINES), table(headings, cells, { source: { state: MACHINES }, key: "machineId" })),
  ],
)
