import { field, row, type UiNodeSpec } from "@effect-agent/effect-ui"

export const answer = (guard: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: { source: { state: guard } },
  children: [...children],
})

export const answered = (label: string, path: string, entry: UiNodeSpec | readonly UiNodeSpec[], empty = "None"): UiNodeSpec =>
  field(label, row([
    { component: "Text", props: { value: empty, size: "2", color: "gray" },
      visible: { source: { state: `${path}/0` }, not: true } },
    { component: "Flex", props: { gap: "1", wrap: "wrap", align: "center" },
      repeat: { source: { state: path } }, children: Array.isArray(entry) ? [...entry] : [entry] },
  ]))

export const answeredChip = (label: string, path: string): UiNodeSpec =>
  field(label, row([{ component: "Code", props: { size: "2" }, bind: path }]))
