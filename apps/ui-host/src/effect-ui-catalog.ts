/**
 * What a canvas can be built from: the component types the host's definition
 * store carries, and the extensions registered beside them.
 *
 * Both on one screen, because the two tables answer one question an operator
 * asks once — what is available to put on a canvas. Each list keeps its own read
 * state and its own empty sentence, since either can be empty while the other is
 * full, and a verdict shared between them would have to be wrong about one.
 *
 * Neither is a card: a table carries its own surface and its own hairlines, and
 * a card around a table is the composition the design system names as a defect
 * (design-system §7).
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, emptyRows, heading, loadingRows, stateRows, table, whenRows } from "@effect-agent/effect-ui"
import { readFailed, type UiHostSource } from "./effect-ui-sources.ts"

interface Inventory {
  readonly title: string
  /** The source's declared id, where its read verdict is kept. */
  readonly id: UiHostSource
  /** The list's own path inside that source. */
  readonly path: string
  readonly column: string
  /** The field a row is addressed by, which is also the repeat's key. */
  readonly key: string
  readonly empty: string
  /** What this list's failed read says, with the press that reads it again. */
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
