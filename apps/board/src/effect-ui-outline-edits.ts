import { heading, press, row, text, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, labelled } from "./effect-ui-fields.ts"

const loaded: UiNodeSpec["visible"] = { source: { state: "/outline/read/docId" } }

const applied: UiNodeSpec = { ...toneBadge("ok", "Applied"), visible: { source: { state: "/outlineResult/docId" } } }

const parentOption: UiNodeSpec =
  ({ component: "Select.Item", item: "nodeId", as: "value", children: [{ component: "Text", item: "text" }] })

const parentPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/outline/insert/parentId",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Top level" } },
    { component: "Select.Content", children: [
      { component: "Select.Label", children: [text("A node at the top level")] },
      { component: "Select.Group", repeat: { source: { state: "/outline/read/nodes" } }, children: [parentOption] },
    ] },
  ],
}

const rename: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: loaded,
  children: [
    entry("Document title", "/outline/rename/title"),
    row([press("Rename document", "board.retitle", undefined, { variant: "solid" })]),
  ],
}

const insert: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: loaded,
  children: [
    entry("Node text", "/outline/insert/text"),
    labelled("First node under", parentPicker),
    row([{ ...press("Insert node", "board.insertNode", undefined, { variant: "solid" }),
      visible: { source: { state: "/outline/insert/text" } } }]),
  ],
}

export const outlineEdits: readonly UiNodeSpec[] = [
  { ...row([heading("Edit", { size: "3" }), applied]), visible: loaded },
  rename,
  insert,
]
