import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { frontCell, identity, kindBadge, monoCell, openCell, stateCell } from "./effect-ui-cells.ts"
import { AGENTS_SOURCE, cellOf, listCard, rowsPath } from "./effect-ui-nodes.ts"

export const fleetCard: UiNodeSpec = listCard({
  title: "Terminal agents",
  id: AGENTS_SOURCE,
  empty: "No terminal agent is running. Herdr tracks one once it recognizes a coding agent inside a pane, so this fills in on its own when one starts, or when Start a terminal agent opens one.",
  headings: ["Terminal agent", "Kind", "State", "Workspace", "Directory", "In front", "Open"],
  cells: [
    identity("terminal_title_stripped", "pane_id"),
    cellOf([kindBadge("agent")]),
    stateCell("agent_status"),
    monoCell("workspace_id"),
    monoCell("foreground_cwd"),
    frontCell("focused"),
    openCell,
  ],
  repeat: { source: { state: rowsPath(AGENTS_SOURCE) }, key: "pane_id" },
})
