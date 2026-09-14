/**
 * Starting an agent: the one form in this console.
 *
 * Three fields, and only one of them is Herdr's protocol. A pane is where layout
 * happens to be and an operator starting an agent is thinking about the agent, so
 * the pane is found rather than named — and the workspace is a picker over the
 * workspaces the server actually has open, because a workspace id typed by hand
 * is a typo away from an agent started somewhere nobody is looking.
 *
 * The picker's rows come from the workspaces read, so the read's own states are
 * stated here too: a picker over a failed read is an empty dropdown with no
 * explanation, and an operator would read that as "there is nowhere to start one".
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { command } from "./effect-ui-command.ts"
import { mono } from "./effect-ui-cells.ts"
import { readFailure, retry } from "./effect-ui-failures.ts"
import { WORKSPACES_SOURCE, draft, emptyRows, field, loadingRows, row, rowsPath, section, text } from "./effect-ui-nodes.ts"
import { serverRow } from "./effect-ui-header.ts"

/** One workspace, as the item a person picks: the id travels, the label is what they read. */
const workspaceOption: UiNodeSpec = {
  component: "Select.Item",
  item: "workspace_id",
  as: "value",
  children: [row([
    { component: "Text", item: "label" },
    mono("workspace_id"),
  ])],
}

/**
 * The workspace to start in.
 *
 * Empty is the focused workspace, which is why the trigger says so rather than
 * saying nothing: an untouched picker sends no choice at all, and the server
 * reads that as "wherever I am" (`agent-start-ops.ts`).
 */
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
