import { cellOf, heading, press, row, sourceStates, stateRows, table, text, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, refusal } from "./effect-ui-fields.ts"
import { outcome } from "./effect-ui-outcome.ts"

const nameCell: UiNodeSpec = cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    { component: "Text", props: { size: "2", weight: "medium" }, item: "title" },
    { component: "Code", props: { size: "1" }, item: "docId" },
  ],
})

const versionCell: UiNodeSpec = cellOf({ component: "Code", props: { size: "1" }, item: "version" })

const movesCell: UiNodeSpec = cellOf(row([
  press("Open", "board.openDocument", { docId: { item: "docId" } }, { size: "1", variant: "soft" }),
  press("Delete", "board.deleteDocument", { docId: { item: "docId" } }, { size: "1", variant: "soft", color: "red" }),
]))

const listing: UiNodeSpec = whenRows(stateRows("/documents/documents"),
  table(["Document", "Version", ""], [nameCell, versionCell, movesCell],
    { source: { state: "/documents/documents" }, key: "docId" }))

export const documentScreen: readonly UiNodeSpec[] = [
  heading("Documents", { size: "4" }),
  text("Outlines. Every edit is one operation against the version the tree was read at.",
    { size: "2", color: "gray" }),
  ...sourceStates("documents", "No document exists yet. Create the first one below."),
  listing,
  refusal("/docResult/error"),
  outcome([], [["/docResult/ok", "Deleted"]]),
  { component: "Flex", props: { direction: "column", gap: "3" }, children: [
    entry("Title", "/docDraft/title"),
    outcome([press("Create document", "board.createDocument", undefined, { variant: "solid" })],
      [["/docResult/docId", "Created"]]),
  ] },
]
