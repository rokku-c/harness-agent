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
