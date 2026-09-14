import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { mono, stateBadge } from "./effect-ui-cells.ts"
import { command } from "./effect-ui-command.ts"
import { AGENTS_SOURCE, navTarget, readField, row, rowsPath, section, sourceStatusPath, text } from "./effect-ui-nodes.ts"
import { AGENTS_REFRESH_MS, FLEET_TAIL, SCROLLBACK_LINES, terminal } from "./effect-ui-reads.ts"

const liveAgent: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  repeat: { source: { state: rowsPath(AGENTS_SOURCE) } },
  visible: { source: { item: "pane_id" }, equals: { state: navTarget } },
  children: [
    row([
      { component: "Text", props: { size: "2", weight: "medium" }, item: "terminal_title_stripped" },
      stateBadge("agent_status"),
      mono("workspace_id"),
      mono("foreground_cwd"),
    ]),
    terminal({ item: "tail/text" }),
    { component: "Text", props: { value: "The fleet read got no output from this agent. It fills in on the next read.", size: "2", color: "gray" },
      visible: { source: { item: "tail/text" }, not: true } },
  ],
}

const liveMissing: UiNodeSpec = {
  component: "Text",
  props: { value: "Herdr's fleet read lists no agent at this pane, so there is nothing live to show here.", size: "2", color: "gray" },
  visible: { source: { state: `${sourceStatusPath(AGENTS_SOURCE)}/state` }, equals: "empty" },
}

export const liveOutput: UiNodeSpec = section("Live output", [
  text(`The last ${FLEET_TAIL} lines, re-read every ${AGENTS_REFRESH_MS / 1000} seconds.`, { size: "2", color: "gray" }),
  liveAgent,
  liveMissing,
])

export const scrollback: UiNodeSpec = section(`The last ${SCROLLBACK_LINES} lines`, [
  text("Read when you press it, and not before: a snapshot does not move with the live output above.", { size: "2", color: "gray" }),
  { component: "Text", props: { value: "Herdr cut this off: the screen holds more than was asked for.", size: "2", color: "gray" },
    visible: { source: { state: readField("herdr.agentOutput", "truncated") }, equals: true } },
  command({ label: "Read now", action: "herdr.agentOutput", sentence: "Could not read this agent." }),
  terminal({ bind: readField("herdr.agentOutput", "text") }),
])
