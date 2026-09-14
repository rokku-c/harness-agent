/**
 * What an agent is printing, in the two reads that carry it.
 *
 * The live block is the fleet source, filtered to the agent this screen is about:
 * a guard on a repeated node that reads the item is a filter rather than a hidden
 * list (`splitRepeatVisibility`), so one read of the fleet serves every screen
 * that shows one of its agents. That is the whole of what makes a terminal move.
 * The alternative — a source whose url names an agent — names whichever agent was
 * selected when the page loaded and never another, which is why the fleet's own
 * read carries a tail of each agent instead.
 *
 * The scrollback is the screen's own read, made when the screen opened. It is
 * longer than the glance and it is a snapshot, so it is a block of its own with
 * its own retry, and its press sits above the text it re-reads rather than under
 * two hundred lines of it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { mono, stateBadge } from "./effect-ui-cells.ts"
import { command } from "./effect-ui-command.ts"
import { AGENTS_SOURCE, navTarget, readField, row, rowsPath, section, sourceStatusPath, text } from "./effect-ui-nodes.ts"
import { AGENTS_REFRESH_MS, FLEET_TAIL, SCROLLBACK_LINES, terminal } from "./effect-ui-reads.ts"

/** The one row of the fleet that is this screen's agent, with the last lines it printed. */
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
    // Herdr answers the listing without a tail for an agent whose read failed, so
    // the row says which of the two it is: nothing printed, or nothing read.
    { component: "Text", props: { value: "The fleet read got no output from this agent. It fills in on the next read.", size: "2", color: "gray" },
      visible: { source: { item: "tail/text" }, not: true } },
  ],
}

/**
 * What stands in for the live block when the fleet cannot be showing this agent:
 * the read has not answered, or it answered with no agent at all.
 *
 * One sentence for both, because it is true in both — the fleet read lists no
 * agent at this pane — and a second sentence would be the same fact told twice,
 * with one of the two wrong half the time.
 */
const liveMissing: UiNodeSpec = {
  component: "Text",
  props: { value: "Herdr's fleet read lists no agent at this pane, so there is nothing live to show here.", size: "2", color: "gray" },
  visible: { any: [
    { source: { state: `${sourceStatusPath(AGENTS_SOURCE)}/answered` }, not: true },
    { source: { state: `${sourceStatusPath(AGENTS_SOURCE)}/state` }, equals: "empty" },
  ] },
}

export const liveOutput: UiNodeSpec = section("Live output", [
  text(`The last ${FLEET_TAIL} lines, read with the fleet every ${AGENTS_REFRESH_MS / 1000} seconds.`, { size: "2", color: "gray" }),
  liveAgent,
  liveMissing,
])

export const scrollback: UiNodeSpec = section(`The last ${SCROLLBACK_LINES} lines`, [
  text("Read when this screen opened.", { size: "2", color: "gray" }),
  // Herdr answers with the tail of a longer screen when it holds more, and a part
  // of an answer shown as the whole of one is the one lie a terminal read can tell
  { component: "Text", props: { value: "Herdr cut this off: the screen holds more than was asked for.", size: "2", color: "gray" },
    visible: { source: { state: readField("herdr.agentOutput", "truncated") }, equals: true } },
  command({ label: "Read again", action: "herdr.agentOutput", sentence: "Could not read this agent." }),
  terminal({ bind: readField("herdr.agentOutput", "text") }),
])
