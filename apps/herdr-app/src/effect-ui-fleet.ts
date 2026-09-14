/**
 * The fleet: every terminal agent Herdr has recognized, and the one press an
 * operator makes from a row.
 *
 * A table rather than a wall of cards, because this is a list of records of one
 * shape read against each other — which agent is in which workspace, which is
 * waiting on an approval, which one is the pane in front. Density 7 is what makes
 * a fleet legible at all: a card per agent fits four on a screen and says less.
 *
 * A row's press only picks the agent. What fills the screen it opens is that
 * screen's own read, so a row and an address pasted into the bar are one arrival
 * — and the list is never the place an answer about one agent lands.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { frontCell, identity, kindBadge, monoCell, openCell, stateCell } from "./effect-ui-cells.ts"
import { AGENTS_SOURCE, cellOf, listCard, rowsPath } from "./effect-ui-nodes.ts"

export const fleetCard: UiNodeSpec = listCard({
  title: "Terminal agents",
  id: AGENTS_SOURCE,
  // what is absent, then the route by which it arrives — including the control on
  // this screen that arrives at it
  empty: "No terminal agent is running. Herdr tracks one once it recognizes a coding agent inside a pane, so this fills in on its own when one starts, or when Start a terminal agent opens one.",
  headings: ["Terminal agent", "Kind", "State", "Workspace", "Directory", "In front", "Open"],
  cells: [
    identity("terminal_title_stripped", "pane_id"),
    cellOf([kindBadge("agent")]),
    stateCell("agent_status"),
    monoCell("workspace_id"),
    monoCell("foreground_cwd"),
    frontCell("focused"),
    // every target in this app is a pane, which is the one id Herdr always has
    openCell,
  ],
  repeat: { source: { state: rowsPath(AGENTS_SOURCE) }, key: "pane_id" },
})
