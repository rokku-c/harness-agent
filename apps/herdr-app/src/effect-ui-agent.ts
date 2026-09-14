import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { agentCommands } from "./effect-ui-commands.ts"
import { readFailure, retry } from "./effect-ui-failures.ts"
import { AGENTS_SOURCE, loadingRows, navTarget, region, row, text } from "./effect-ui-nodes.ts"
import { liveOutput, scrollback } from "./effect-ui-output.ts"

const named: UiNodeSpec["visible"] = { source: { state: navTarget } }

const address: UiNodeSpec = row([
  text("Pane", { size: "1", color: "gray" }),
  { component: "Code", props: { size: "2", variant: "soft" }, bind: navTarget, visible: named },
  { component: "Text", props: { value: "No agent is named in this address. Open one from the fleet.", size: "2", color: "gray" },
    visible: { source: { state: navTarget }, not: true } },
])

export const agentScreen: readonly UiNodeSpec[] = [
  address,
  { ...region([
    loadingRows(AGENTS_SOURCE, 3),
    readFailure(AGENTS_SOURCE, "Could not read this agent's output.", retry("herdr.readFleet")),
    liveOutput,
    scrollback,
  ]), visible: named },
  { ...agentCommands, visible: named },
]
