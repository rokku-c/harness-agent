/**
 * The workspaces Herdr has open, as Herdr has them.
 *
 * Read-only, and drawn where a start can see it: this console arranges nothing.
 * A workspace is layout, Herdr already has a UI for layout, and an operator who
 * came here is looking at agents — so what this answers is which workspaces
 * exist, which one is in front, and which of them wants attention. The label is
 * whatever the operator called it, which is not this app's to improve on.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyRows, failureNotice, loadingRows, row, section, stateBadge } from "@effect-agent/effect-ui"
import { rowsPath, workspacesSource } from "./effect-ui-nodes.ts"

const line: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "center", gap: "2" },
  children: [
    { component: "Text", props: { size: "2", truncate: true }, item: "label" },
    row([
      { component: "Badge", props: { variant: "solid", value: "focused" },
        visible: { source: { item: "focused" }, equals: true } },
      stateBadge("agent_status"),
    ]),
  ],
}

export const workspaceNodes: readonly UiNodeSpec[] = [
  section("Workspaces", [
    loadingRows(workspacesSource, 2), failureNotice(workspacesSource),
    emptyRows(workspacesSource, rowsPath(workspacesSource), "This Herdr server has no workspace open."),
    { component: "Flex", props: { direction: "column", gap: "2" },
      repeat: { source: { state: rowsPath(workspacesSource) }, key: "workspace_id" }, children: [line] },
  ]),
]
