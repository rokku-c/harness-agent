import { cellOf, chip, chipList, itemRows, section, stateRows, table, type UiNodeSpec } from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { DECISION } from "./effect-ui-paths.ts"

const SETS = `${DECISION}/sets`

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
