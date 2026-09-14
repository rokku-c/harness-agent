/**
 * One canvas as the runtime resolved it: the identity an operator was handed,
 * and the nodes it is built from.
 *
 * This is the readout of a press, so it is the one card this console draws — a
 * tool's result panel, which is where the design system allows one
 * (design-system §7). The version leads the panel rather than sitting in a
 * column, because a canvas is read at a version: it is the field that says
 * whether what is on screen is what the agent last wrote.
 *
 * The canvas is named here even though the row that opened it was named too: a
 * screen can be reached by a pasted link with no row behind it, and a panel that
 * assumes its own row is a panel that is blank on the one path that has none.
 *
 * The nodes table is drawn only while the answer carries a first node. "No
 * document has been read" and "this document holds no node" are two answers, and
 * a header row over no rows says the second while the first is true.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, chipList, emptyMessage, section, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"

const loaded = "/canvas/loaded"

/** One field of the resolved canvas: its label, then the value in mono. */
const field = (label: string, bind: string): UiNodeSpec => ({
  component: "DataList.Item",
  children: [
    { component: "DataList.Label", props: { value: label } },
    { component: "DataList.Value", children: [{ component: "Code", props: { size: "2" }, bind }] },
  ],
})

/** Nothing is claimed until the canvas has been read: an unanswered read has no identity to state. */
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
    // the failure is the press's own answer, so it is written above the panel it
    // was meant to fill rather than on the screen that asked for it. Its retry is
    // that same press, and it carries no values: `loadCanvas` states on the
    // action where its id comes from, so the second read asks for the canvas this
    // screen is on — the one the failed read asked for — rather than one named here.
    refused("Could not read this canvas.", `${loaded}/error`, retry("uiHost.loadCanvas")),
    identity,
    undrawn,
    whenRows(stateRows(`${loaded}/children`), document),
  ]),
]
