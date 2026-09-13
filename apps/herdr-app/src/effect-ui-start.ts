/**
 * Starting an agent.
 *
 * Name it and say what kind it is; where it goes is one picker. The pane is not
 * asked for because it is not the operator's question: Herdr starts an agent only
 * in a pane that already holds a free shell, and which pane that happens to be
 * has nothing to do with what anyone wanted. Left alone, the picker means the
 * workspace Herdr is already focused on — the same one a person would have
 * chosen — and the app finds the pane itself.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyRows, field, row, section } from "@effect-agent/effect-ui"
import { draft, outcomeRow, press, rowsPath, workspacesSource } from "./effect-ui-nodes.ts"

/** An item's own label is a child: the item's `value` is its value, not its text. */
const workspaceItem: UiNodeSpec = {
  component: "Select.Item", item: "workspace_id", children: [{ component: "Text", item: "label" }],
}

/**
 * Seeded empty rather than left out. A control bound to a value the state does
 * not carry renders uncontrolled and then changes under the operator's hands;
 * the empty string is how "no choice" is written here, and the start reads it
 * that way rather than as a workspace named nothing.
 */
const workspacePicker: UiNodeSpec = {
  component: "Select.Root",
  bind: draft("startWorkspace"),
  children: [
    { component: "Select.Trigger", props: { placeholder: "Where Herdr is focused" } },
    { component: "Select.Content", repeat: { source: { state: rowsPath(workspacesSource) }, key: "workspace_id" }, children: [workspaceItem] },
  ],
}

export const startNodes: readonly UiNodeSpec[] = [
  section("Start an agent", [
    field("Name", { component: "TextField.Root", props: { placeholder: "lowercase, unique among live agents" }, bind: draft("startName") }),
    field("Kind", { component: "TextField.Root", props: { placeholder: "claude, codex, gemini…" }, bind: draft("startKind") }),
    field("Workspace", workspacePicker),
    emptyRows(workspacesSource, rowsPath(workspacesSource), "No workspace is open to start in."),
    row([press("Start", "herdr.agentStart", undefined, { variant: "solid" })]),
    outcomeRow("agentStart", "started"),
  ]),
]
