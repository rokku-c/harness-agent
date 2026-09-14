import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { frontCell, identity, stateCell } from "./effect-ui-cells.ts"
import { readFailure, retry } from "./effect-ui-failures.ts"
import { serverRow } from "./effect-ui-header.ts"
import { WORKSPACES_SOURCE, cellOf, listCard, loadingRows, region, rowsPath, text } from "./effect-ui-nodes.ts"

const count = (field: string): UiNodeSpec => cellOf([{ component: "Text", item: field }])

export const workspacesCard: UiNodeSpec = listCard({
  title: "Workspaces",
  id: WORKSPACES_SOURCE,
  empty: "This Herdr server has no workspace open. Herdr keeps at least one while it is running, so this fills in on its own; start one in Herdr if you closed the last.",
  headings: ["Workspace", "Panes", "Tabs", "Agents", "In front"],
  cells: [
    identity("label", "workspace_id"),
    count("pane_count"),
    count("tab_count"),
    stateCell("agent_status"),
    frontCell("focused"),
  ],
  repeat: { source: { state: rowsPath(WORKSPACES_SOURCE) }, key: "workspace_id" },
})

export const workspacesScreen: readonly UiNodeSpec[] = [
  text("Where an agent may be started, and which one an operator is looking at. Nothing here moves a pane.", { size: "2", color: "gray" }),
  serverRow,
  region([
    loadingRows(WORKSPACES_SOURCE, 4),
    readFailure(WORKSPACES_SOURCE, "Could not read the workspaces.", retry("herdr.readWorkspaces")),
    workspacesCard,
  ]),
]
