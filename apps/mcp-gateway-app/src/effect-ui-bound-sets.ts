/**
 * The sets this principal is bound to, and what each of them would route.
 *
 * It is here rather than only on the topology screen because the answer to "why
 * not" is a property of *this principal's* sets: the topology names every set
 * the center declares, and an operator reading a denial needs the two or three
 * that could have decided it, with the servers each one actually reaches.
 *
 * A server is drawn with its reachability rather than as a bare id, because a
 * set naming a server the registry cannot resolve is the difference between a
 * refusal a grant edit would fix and one a registration would. That is the walk
 * `binding → set → servers → tools`, read off the engine's own resolver rather
 * than re-derived here.
 *
 * A null allow list and an empty one are two different answers — the first
 * admits everything the set reaches, the second admits nothing — so the cell
 * states the first in words and draws chips for the second. Collapsing them
 * would make the commonest set in the system read as the strictest.
 */
import { cellOf, chip, chipList, itemRows, section, stateRows, table, type UiNodeSpec } from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { DECISION } from "./effect-ui-paths.ts"

const SETS = `${DECISION}/sets`

/** A plain sentence in a cell: `text` writes only props, and this one carries a guard. */
const note = (value: string, visible: UiNodeSpec["visible"]): UiNodeSpec =>
  ({ component: "Text", props: { value, size: "1", color: "gray" }, visible })

const servers: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "1", align: "start" },
  repeat: { source: { item: "servers" } },
  children: [{ component: "Flex", props: { gap: "2", align: "center" }, children: [
    chip("serverId"),
    { component: "Text", props: { value: "not reachable", size: "1", color: "gray" },
      visible: { source: { item: "reachable" }, not: true } },
  ] }],
}

/** The strings a set holds, or the word for holding none — read off the list's own first row. */
const strings = (path: string, nothing: string): readonly UiNodeSpec[] =>
  [chipList({ source: { item: path } }, ""), note(nothing, { ...itemRows(path), not: true })]

export const boundSets: UiNodeSpec = {
  ...section("Bound to", [
    table(
      ["Set", "Servers", "Allows", "Denies"],
      [
        titled("name", "setId"),
        cellOf([servers, note("no server", { ...itemRows("servers"), not: true })]),
        cellOf([
          note("every tool the set reaches", { source: { item: "allowTools" }, not: true }),
          chipList({ source: { item: "allowTools" } }, ""),
        ]),
        cellOf(strings("denyTools", "none")),
      ],
      { source: { state: SETS } },
    ),
    { component: "Text", props: { value: "A set with no allow list admits every tool its servers declare.", size: "1", color: "gray" } },
  ]),
  visible: stateRows(SETS),
}
