import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { command } from "./effect-ui-command.ts"
import { mono } from "./effect-ui-cells.ts"
import { readFailure, retry } from "./effect-ui-failures.ts"
import { WORKSPACES_SOURCE, draft, emptyRows, field, loadingRows, row, rowsPath, section, text } from "./effect-ui-nodes.ts"
import { serverRow } from "./effect-ui-header.ts"

const workspaceOption: UiNodeSpec = {
  component: "Select.Item",
  item: "workspace_id",
  as: "value",
  children: [row([
    { component: "Text", item: "label" },
    mono("workspace_id"),
  ])],
}

const workspacePicker: UiNodeSpec = {
  component: "Select.Root",
  bind: draft("startWorkspace"),
  children: [
    { component: "Select.Trigger", props: { placeholder: "The workspace in front" } },
    { component: "Select.Content", children: [
      { component: "Select.Group",
        repeat: { source: { state: rowsPath(WORKSPACES_SOURCE) } },
        children: [workspaceOption] },
    ] },
  ],
}

export const startScreen: readonly UiNodeSpec[] = [
  serverRow,
  section("Start a terminal agent", [
    text("Herdr starts it in a free shell pane of the workspace you name, and tracks its lifecycle from there.", { size: "2", color: "gray" }),
    field("Name", { component: "TextField.Root", props: { placeholder: "reviewer" }, bind: draft("startName") }),
    field("Kind", { component: "TextField.Root", props: { placeholder: "claude" }, bind: draft("startKind") }),
    field("Workspace", workspacePicker),
    loadingRows(WORKSPACES_SOURCE, 2),
    readFailure(WORKSPACES_SOURCE, "Could not read the workspaces.", retry("herdr.readWorkspaces")),
    emptyRows(WORKSPACES_SOURCE, rowsPath(WORKSPACES_SOURCE),
      "No workspace is open on this server. Herdr starts an agent only in a pane a shell is already waiting in, so this fills in once one is open."),
    row([command({ label: "Start", action: "herdr.agentStart", variant: "solid", sentence: "Start was refused.", done: "started" })]),
    text("The name is how Herdr addresses this agent from then on: lowercase, digits, _ and -, and unique among the running agents.", { size: "1", color: "gray" }),
  ]),
]
