import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, emptyRows, failureNotice, itemRows, keyCell, loadingRows, region, section, table, text, whenRows } from "./effect-ui-nodes.ts"
import { addForm, recordForm } from "./effect-ui-record-forms.ts"

const present = (item: string, node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { item } } })

const recordCells: readonly UiNodeSpec[] = [
  cellOf([{ component: "Text", item: "text" }, present("source", { component: "Text", props: { size: "1", color: "gray" }, item: "source" })]),
  keyCell("id"),
]

const resourceBlock: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  children: [
    { component: "Heading", props: { size: "3" }, item: "label" },
    { component: "Text", props: { size: "2", color: "gray" }, item: "write/description" },
    whenRows(itemRows("records"), table(["Record", "Id"], recordCells, { source: { item: "records" }, key: "id" })),
    { component: "Text", props: { value: "This kind holds no record yet.", size: "2", color: "gray" },
      visible: { source: { item: "records/0" }, not: true } },
  ],
}

export const recordsNodes: readonly UiNodeSpec[] = [
  region([
    section("Records", [
      text("What this host holds on behalf of an agent: the kinds it declares and the records written under them.", { size: "2", color: "gray" }),
      loadingRows("records", 3),
      failureNotice("records"),
      emptyRows("records", "/mantis/records/resources", "No record kind is declared on this host yet."),
      { component: "Flex", props: { direction: "column", gap: "5" },
        repeat: { source: { state: "/mantis/records/resources" }, key: "kind" }, children: [resourceBlock] },
    ]),
    section("Add a record", [addForm]),
    section("Change or delete a record", [
      text("Both writes address one record by its id, which is the code at the end of its row.", { size: "2", color: "gray" }),
      recordForm,
    ]),
  ]),
]
