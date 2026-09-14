import { toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import { failedBadge, outcome, refusedBadge, refusedWriteBadge } from "./effect-ui-feedback.ts"
import { field, press, row } from "./effect-ui-nodes.ts"

const kindItem: UiNodeSpec = { component: "Select.Item", item: "kind", children: [{ component: "Text", item: "label" }] }

const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/recordAdd/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a kind" } },
    { component: "Select.Content", repeat: { source: { state: "/mantis/records/resources" }, key: "kind" }, children: [kindItem] },
  ],
}

export const addForm: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Kind", kindPicker),
    field("Text", { component: "TextArea", bind: "/recordAdd/text" }),
    row([press("Add record", "mantis.recordAdd", { kind: { state: "/recordAdd/kind" }, text: { state: "/recordAdd/text" } })]),
    row([...outcome("/mantis/recordAdd", "/mantis/recordAdd/ok", "Record added")]),
  ],
}

export const recordForm: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Record id", { component: "TextField.Root", bind: "/recordEdit/recordId" }),
    field("Replacement text", { component: "TextField.Root", bind: "/recordEdit/text" }),
    row([
      press("Update record", "mantis.recordUpdate", { recordId: { state: "/recordEdit/recordId" }, text: { state: "/recordEdit/text" } }),
      press("Delete record", "mantis.recordDelete", { recordId: { state: "/recordEdit/recordId" } }, { variant: "soft", color: "red" }),
    ]),
    row([...outcome("/mantis/recordUpdate", "/mantis/recordUpdate/ok", "Record updated")]),
    row([
      { ...toneBadge("ok", "Record deleted"), visible: { source: { state: "/mantis/recordDelete/ok" }, equals: true } },
      refusedWriteBadge("/mantis/recordDelete"),
      failedBadge("/mantis/recordDelete"),
    ]),
  ],
}
