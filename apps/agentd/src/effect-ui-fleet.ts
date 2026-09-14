/**
 * The screen the app starts on: the fleet itself, and the two doors out of it.
 *
 * The fleet is the surface rather than a menu entry, because it is what an
 * operator comes back to read; a fleet behind a door costs a press every time
 * and shows nothing when nobody presses. The two doors lead to the queue the
 * fleet's work lands in and to the servers it is assembled from, and both sit
 * above the scrolling region so a screen of rows cannot carry them off it.
 *
 * One failure notice stands for the whole screen. The fleet is one read, so the
 * three inventories below it share one verdict: three copies of one failed read
 * would be the same sentence three times and would each have to be believed
 * separately. A list with nothing in it says so itself, which is a fact about
 * the list and not about the read.
 */
import { heading, press, region, row, sourceStatusPath, text, type UiNodeSpec } from "@effect-agent/effect-ui"
import { agentsBlock } from "./effect-ui-agents.ts"
import { livenessBlock } from "./effect-ui-liveness.ts"
import { machinesBlock } from "./effect-ui-machines.ts"
import { STATUS_SOURCE } from "./effect-ui-paths.ts"
import { readFailure, sourceFailed } from "./effect-ui-read.ts"

const door = (label: string, action: string): UiNodeSpec =>
  press(label, action, undefined, { variant: "soft", size: "2" })

const header: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "start", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Fleet", { size: "4" }),
      text("What each machine and fleet agent is bound to run, and what it reported back.", { size: "2", color: "gray" }),
    ] },
    row([door("Launches", "agentd.openLaunches"), door("MCP servers", "agentd.openServers")]),
  ],
}

export const fleetScreen: readonly UiNodeSpec[] = [
  header,
  region([
    readFailure(sourceFailed(STATUS_SOURCE), "Could not read the fleet.",
      `${sourceStatusPath(STATUS_SOURCE)}/error`, "agentd.retryStatus"),
    agentsBlock,
    machinesBlock,
    livenessBlock,
  ]),
]
