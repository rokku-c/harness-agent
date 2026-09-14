/**
 * The two declarations the door enforces, read where they are made.
 *
 * They are on this screen and not in a screen of their own because they are
 * unreadable apart: a set is a list of servers and tools, and a binding is which
 * principal is handed which set — a set nobody is bound to grants nothing, and a
 * binding to a set that no longer exists grants nothing either, so either list
 * alone leaves the operator to join the two by id.
 *
 * Both are *read* here. A set and a binding are declared in the center that
 * issues the identity they are keyed by, and this app reads them from there so
 * the fact has one author (`effect-config.ts`); a console offering to edit them
 * would be the second one. That is also why a denial on the access screen points
 * here and stops: this screen names the set that decided, and the change is made
 * somewhere this app cannot reach.
 *
 * Each binding carries the revision the center wrote it at, so a reader can say
 * which revision an answer was decided against (M2 step 3, J2).
 */
import { cellOf, chip, chipList, emptyRows, itemRows, section, stateRows, table, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { BINDINGS, SETS, TOPOLOGY } from "./effect-ui-paths.ts"

/** A plain sentence in a cell: `text` writes only props, and this one carries a guard. */
const note = (value: string, visible: UiNodeSpec["visible"]): UiNodeSpec =>
  ({ component: "Text", props: { value, size: "1", color: "gray" }, visible })

/** What a set holds, or the word for holding none — read off the list's own first row. */
const strings = (path: string, nothing: string): readonly UiNodeSpec[] =>
  [chipList({ source: { item: path } }, ""), note(nothing, { ...itemRows(path), not: true })]

export const setsTable: UiNodeSpec = section("Sets", [
  { component: "Text", props: { value: "A deny list outranks an allow list; a set with no allow list admits every tool its servers declare.", size: "1", color: "gray" } },
  emptyRows(TOPOLOGY, SETS, "No set is declared. Sets are declared in the agentd center and appear here once they are."),
  whenRows(stateRows(SETS), table(
    ["Set", "Servers", "Allows", "Denies"],
    [
      titled("name", "setId"),
      cellOf(strings("servers", "no server")),
      cellOf([
        note("every tool the set reaches", { source: { item: "allowTools" }, not: true }),
        chipList({ source: { item: "allowTools" } }, ""),
      ]),
      cellOf(strings("denyTools", "none")),
    ],
    { source: { state: SETS } },
  )),
])

export const bindingsTable: UiNodeSpec = section("Bindings", [
  { component: "Text", props: { value: "A principal with no binding reaches nothing, whatever the sets say.", size: "1", color: "gray" } },
  emptyRows(TOPOLOGY, BINDINGS, "No principal is bound to a set. A binding is declared in the agentd center and appears here once it is."),
  whenRows(stateRows(BINDINGS), table(
    ["Principal", "Sets", "Revision"],
    [
      cellOf(chip("agentId")),
      cellOf([chipList({ source: { item: "setIds" } }, ""), note("no set", { ...itemRows("setIds"), not: true })]),
      cellOf([chip("revision")]),
    ],
    { source: { state: BINDINGS } },
  )),
])
