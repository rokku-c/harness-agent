import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, chipList, emptyMessage, section, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"

const loaded = "/canvas/loaded"

const field = (label: string, bind: string): UiNodeSpec => ({
  component: "DataList.Item",
  children: [
    { component: "DataList.Label", props: { value: label } },
    { component: "DataList.Value", children: [{ component: "Code", props: { size: "2" }, bind }] },
  ],
})

const identity: UiNodeSpec = {
  component: "DataList.Root",
  visible: { source: { state: `${loaded}/canvasId` } },
  children: [
    field("Canvas", `${loaded}/title`),
    field("Canvas id", `${loaded}/canvasId`),
    field("Version", `${loaded}/version`),
  ],
}

const undrawn: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column" },
  visible: { source: { state: `${loaded}/canvasId` } },
  children: [emptyMessage(`${loaded}/children`,
    "No node is on this canvas. An agent adds one by calling ui_insert_node.")],
}

const document: UiNodeSpec = table(
  ["Component", "Node", "Children"],
  [cellOf(chip("type")), cellOf(chip("id")), cellOf(chipList({ source: { item: "resolvedChildren" } }, "type"))],
  { source: { state: `${loaded}/children` }, key: "id" })

export const canvasNodes: readonly UiNodeSpec[] = [
  section("Canvas document", [
    refused("Could not read this canvas.", `${loaded}/error`, retry("uiHost.loadCanvas")),
    identity,
    undrawn,
    whenRows(stateRows(`${loaded}/children`), document),
  ]),
]
