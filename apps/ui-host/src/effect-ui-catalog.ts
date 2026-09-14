import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, emptyRows, heading, loadingRows, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { readFailed, type UiHostSource } from "./effect-ui-sources.ts"

interface Inventory {
  readonly title: string
  readonly id: UiHostSource
  readonly path: string
  readonly column: string
  readonly key: string
  readonly empty: string
  readonly failed: string
}

const inventory = ({ title, id, path, column, key, empty, failed }: Inventory): readonly UiNodeSpec[] => [
  heading(title, { size: "3" }),
  loadingRows(id, 2),
  readFailed(id, failed),
  emptyRows(id, path, empty),
  whenRows(stateRows(path), table([column, "Version"], [cellOf(chip(key)), cellOf(chip("version"))],
    { source: { state: path }, key })),
]

export const catalogNodes: readonly UiNodeSpec[] = [
  ...inventory({ title: "Components", id: "components", path: "/components", column: "Type", key: "type",
    empty: "No component type is registered. One appears here once an agent registers it.",
    failed: "Could not read the component catalog." }),
  ...inventory({ title: "Extensions", id: "extensions", path: "/extensions", column: "Name", key: "name",
    empty: "No extension is enabled. One appears here once its manifest is loaded.",
    failed: "Could not read the extension catalog." }),
]
