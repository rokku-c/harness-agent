import { cellOf, chip, chipList, emptyRows, itemRows, section, stateRows, table, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { BINDINGS, SETS, TOPOLOGY } from "./effect-ui-paths.ts"

const note = (value: string, visible: UiNodeSpec["visible"]): UiNodeSpec =>
  ({ component: "Text", props: { value, size: "1", color: "gray" }, visible })

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
