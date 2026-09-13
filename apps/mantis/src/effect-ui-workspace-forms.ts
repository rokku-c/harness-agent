/**
 * The workspace's write forms. Adding names a kind and takes the text; the
 * form that addresses one record by id is shared by update and delete rather
 * than repeated inside every card, and the kind picker lists the kinds the
 * server declares instead of a hard-coded copy that can drift from them.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row } from "@effect-agent/effect-ui"
import { errorBadge, refusalBadge, writeRefusalBadge } from "./effect-ui-feedback.ts"
import { field } from "./effect-ui-nodes.ts"

/** An item's own label is a child: the item's `value` is its value, not its text. */
const kindItem: UiNodeSpec = { component: "Select.Item", item: "kind", children: [{ component: "Text", item: "label" }] }

const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/workspaceAdd/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a kind" } },
    { component: "Select.Content", repeat: { source: { state: "/mantis/workspace/resources" }, key: "kind" }, children: [kindItem] },
  ],
}

export const addForm: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Kind", kindPicker),
    field("Text", { component: "TextArea", bind: "/workspaceAdd/text" }),
    row([{ component: "Button", props: { value: "Add record" }, onPress: "mantis.workspaceAdd",
      params: { kind: { state: "/workspaceAdd/kind" }, text: { state: "/workspaceAdd/text" } } }]),
    row([refusalBadge("/mantis/workspaceAdd"), errorBadge("/mantis/workspaceAdd")]),
  ],
}

/** One record, named by id: the two writes that need that id live here, not in a row. */
export const recordForm: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Record id", { component: "TextField.Root", bind: "/workspaceEdit/recordId" }),
    field("Replacement text", { component: "TextField.Root", bind: "/workspaceEdit/text" }),
    row([
      { component: "Button", props: { value: "Update record" }, onPress: "mantis.workspaceUpdate",
        params: { recordId: { state: "/workspaceEdit/recordId" }, text: { state: "/workspaceEdit/text" } } },
      { component: "Button", props: { value: "Delete record", variant: "soft", color: "red" }, onPress: "mantis.workspaceDelete",
        params: { recordId: { state: "/workspaceEdit/recordId" } } },
    ]),
    row([
      refusalBadge("/mantis/workspaceUpdate"),
      errorBadge("/mantis/workspaceUpdate"),
      errorBadge("/mantis/workspaceDelete"),
    ]),
    writeRefusalBadge("/mantis/workspaceDelete"),
  ],
}
