/**
 * Every canvas the host has declared, with the one the runtime is showing marked
 * in the row it belongs to.
 *
 * That mark is a column rather than a figure above the list, because "which
 * canvas is on screen" and "which version of it" are one question an operator
 * asks of one row. A canvas named twice — a chip above the table and a row
 * inside it — leaves the reader checking whether the two agree.
 *
 * The empty sentence and the table read one condition, so a header row over no
 * rows cannot happen: a table of columns of nothing reads as a read that failed,
 * and the sentence above it already says the true thing. A failed read is stated
 * once for the source rather than once per list it feeds.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, emptyRows, loadingRows, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { readFailed } from "./effect-ui-sources.ts"

/** The name an operator reads over the key the host addresses the canvas by. */
const identity = (name: string, key: string): UiNodeSpec =>
  cellOf({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name },
    chip(key),
  ] })

/**
 * The runtime's own answer, compared against the row: a canvas is in view when
 * the id the runtime reports is this row's id. Until the runtime has answered
 * the comparison has nothing to match, so no row wears the mark and none wears
 * it wrongly.
 */
const inView: UiNodeSpec = {
  component: "Badge",
  props: { variant: "surface", color: "jade", highContrast: true, value: "In view" },
  visible: { source: { item: "canvasId" }, equals: { state: "/runtime/navigation/current" } },
}

/** The row's own press: it names the canvas and enters that canvas's screen. */
const inspect: UiNodeSpec =
  cellOf({ component: "Button", props: { value: "Inspect", size: "1", variant: "soft" },
    onPress: "uiHost.openCanvas", params: { canvasId: { item: "canvasId" } } })

const canvases = table(
  ["Canvas", "Version", "In view", "Document"],
  [identity("title", "canvasId"), cellOf(chip("version")), cellOf(inView), inspect],
  { source: { state: "/canvases" }, key: "canvasId" })

export const canvasesSection: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    loadingRows("canvases", 3),
    readFailed("canvases", "Could not read the canvas list."),
    emptyRows("canvases", "/canvases", "No canvas is declared on this host. A canvas appears here once an agent creates one."),
    whenRows(stateRows("/canvases"), canvases),
  ],
}
