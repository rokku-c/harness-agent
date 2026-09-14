import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, emptyRows, loadingRows, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { readFailed } from "./effect-ui-sources.ts"

const identity = (name: string, key: string): UiNodeSpec =>
  cellOf({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name },
    chip(key),
  ] })

const inView: UiNodeSpec = {
  component: "Badge",
  props: { variant: "surface", color: "jade", highContrast: true, value: "In view" },
  visible: { source: { item: "canvasId" }, equals: { state: "/runtime/navigation/current" } },
}

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
