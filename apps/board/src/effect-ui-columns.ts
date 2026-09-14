import { press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { taskSignals } from "./effect-ui-signals.ts"
import { stateOptions, type StateOption } from "./effect-ui-states.ts"

const entry: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      { component: "Text", props: { size: "2", weight: "medium" }, item: "title" },
      { component: "Text", props: { size: "1", color: "gray" }, item: "body", visible: { source: { item: "body" } } },
      taskSignals,
    ] },
    row([press("Open", "board.open", { taskId: { item: "id" } }, { size: "1", variant: "soft" })]),
  ],
}

const column = (option: StateOption): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "4" },
  children: [
    { component: "Heading", props: { size: "3", value: option.label } },
    { component: "Flex",
      props: { direction: "column", gap: "3" },
      repeat: { source: { state: "/table/rows" }, key: "id" },
      visible: { source: { item: "state" }, equals: option.value },
      children: [entry] },
  ],
})

export const boardColumns: UiNodeSpec = {
  component: "Grid",
  props: { columns: { initial: "1", sm: "2", md: "3", xl: "5" }, gap: "3", align: "start" },
  children: stateOptions.map((option) => column(option)),
}
