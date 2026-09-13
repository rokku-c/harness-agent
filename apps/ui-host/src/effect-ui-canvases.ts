import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyMessage, sourceStates } from "@effect-agent/effect-ui"
import { cell, cellOf, failure, idCell, identityCell, line, list, section, table, text } from "./effect-ui-nodes.ts"

/**
 * What the last "Inspect" press found: the canvas's own document — the
 * components it is built from, the node ids they are addressed by, and the
 * children each one holds.
 *
 * The row above already carries the canvas's title, the key it is addressed by,
 * and its version, so the readout carries what the row cannot. Naming the
 * canvas again here would be two of the row's facts said a second time, and a
 * press whose answer repeats the row it was pressed on is decoration.
 *
 * The readout is guarded rather than blank: a result with no guard reads as an
 * empty canvas, which is a different thing from a canvas that could not be
 * read. Its table names its own emptiness, one level in, because "no document
 * has been fetched" and "this document has no nodes" are two different answers.
 */
const inspected: readonly UiNodeSpec[] = [
  { component: "Flex", props: { direction: "column", gap: "2" }, visible: { source: { state: "/canvas/loaded/children" } }, children: [
    text("Canvas document", { size: "2", color: "gray" }),
    table(["Component", "Node", "Children"], [
      cell("type"),
      idCell("id"),
      cellOf(list({ source: { item: "resolvedChildren" } }, line("type", { size: "1", color: "gray" }))),
    ], { source: { state: "/canvas/loaded/children" }, key: "id" }),
    emptyMessage("/canvas/loaded/children", "This canvas has no nodes."),
  ] },
  failure("/canvas/loaded/error"),
]

/**
 * The app's primary surface, so it sits directly under the header, and the
 * action that inspects a canvas is on the row that names it: an operator
 * reading a canvas off the list should not then have to type it elsewhere.
 */
export const canvasesSection: UiNodeSpec = section("Canvases", [
  ...sourceStates("canvases", "No canvases are registered yet."),
  table(["Canvas", "Version", "Inspect"], [
    identityCell("title", "canvasId"),
    cell("version"),
    cellOf({ component: "Button", props: { value: "Inspect", size: "1" }, onPress: "uiHost.loadCanvas", params: { canvasId: { item: "canvasId" } } }),
  ], { source: { state: "/canvases" }, key: "canvasId" }),
  ...inspected,
])
