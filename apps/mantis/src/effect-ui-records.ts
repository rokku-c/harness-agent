/**
 * The record store: the kinds this host declares, the records under them, and
 * the writes an operator makes against them.
 *
 * This screen was called the workspace, which is herdr's word for its own unit
 * (flows §1.7, §7.3 dead end 4). Two apps holding different things under one name
 * is the collision the vocabulary rule exists to stop, so the screen and every
 * action that opens it say *records* — the word for what this host holds, and the
 * word the app's own tools already use. The address it reads is unchanged: that
 * is the server's contract, and a console renaming its own screens does not get
 * to rename the store underneath them.
 *
 * The list, the form that adds, and the form that addresses one record are three
 * sections rather than one — a card inside a card is banned (§7), and these three
 * are exactly the case a card is *for*: each block has its own identity and its
 * own controls, so a reader can tell where one ends without a rule between them.
 *
 * A resource's records are a table, and a table is a table: it draws its own
 * hairlines, so nothing here draws one around it.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, emptyRows, failureNotice, itemRows, keyCell, loadingRows, region, section, table, text, whenRows } from "./effect-ui-nodes.ts"
import { addForm, recordForm } from "./effect-ui-record-forms.ts"

/** A record's own field is the only presence test a repeat item offers; the table and the notice read it the same way. */
const present = (item: string, node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { item } } })

const recordCells: readonly UiNodeSpec[] = [
  cellOf([{ component: "Text", item: "text" }, present("source", { component: "Text", props: { size: "1", color: "gray" }, item: "source" })]),
  keyCell("id"),
]

/** One kind: what it holds, then its records. Blocks in plain space, not cards inside the card above them. */
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
  // the store is as long as the host's records are: it scrolls in its own box
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
