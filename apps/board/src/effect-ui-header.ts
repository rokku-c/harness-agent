import { heading, press, type UiNodeSpec } from "@effect-agent/effect-ui"

const item = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value }, children: [{ component: "Text", props: { value: label } }] })

const viewSwitch: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/view",
  children: [item("table", "Worktable"), item("board", "Columns")],
}

export const boardHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "center", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Board", { size: "4" }),
      { component: "Text",
        props: { value: "Hierarchical work items, who holds each one, and what is blocking them.",
          size: "2", color: "gray" } },
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" },
      children: [
        viewSwitch,
        press("Documents", "board.openDocuments", undefined, { variant: "soft" }),
        press("Events", "board.openEvents", undefined, { variant: "soft" }),
        press("New task", "board.new", undefined, { variant: "solid" }),
      ] },
  ],
}
