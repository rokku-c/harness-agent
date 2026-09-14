import { table, type UiNodeSpec, type UiRepeatSpec, type UiVisibilitySpec } from "@effect-agent/effect-ui"

export const filtered = (path: string, field: string): UiVisibilitySpec =>
  ({ any: [
    { source: { state: path }, not: true },
    { source: { item: field }, equals: { state: path } },
  ] })

export const filteredTable = (
  headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec, visible: UiVisibilitySpec,
): UiNodeSpec => {
  const drawn = table(headings, cells, repeat)
  const [header, body] = drawn.children ?? []
  return { ...drawn, children: [header!, { ...body!, visible }] }
}
