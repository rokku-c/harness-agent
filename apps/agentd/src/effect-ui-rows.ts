import { chip, heading, table as tableOf, text, type UiCondition, type UiNodeSpec, type UiRepeatSpec } from "@effect-agent/effect-ui"

export { chip }

export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec): UiNodeSpec => {
  const built = tableOf(headings, cells, repeat)
  return { ...built, props: { ...built.props, size: "1" } }
}

export const block = (title: string, description: string, body: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "5" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading(title, { size: "3" }),
      text(description, { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { direction: "column", gap: "2" }, children: [...body] },
  ],
})

export const screenHead = (title: string, description: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [heading(title, { size: "4" }), text(description, { size: "2", color: "gray" })],
})

export const cellOf = (content: UiNodeSpec | readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Table.Cell", children: Array.isArray(content) ? [...content] : [content] })

export const figure = (field: string, presence: string, missing: string): UiNodeSpec => cellOf([
  { ...chip(field), visible: { source: { item: presence } } },
  { component: "Text", props: { value: missing, size: "2", color: "gray" },
    visible: { source: { item: presence }, not: true } },
])

export const stated = (where: UiCondition["source"], present: string, absent: string): readonly UiNodeSpec[] => [
  { component: "Text", props: { value: present, size: "2" }, visible: { source: where, equals: true } },
  { component: "Text", props: { value: absent, size: "2", color: "gray" }, visible: { source: where, not: true } },
]

export const identity = (name: string, id: string): UiNodeSpec => cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1", align: "start" },
  children: [{ component: "Text", item: name }, chip(id)],
})

export const rowPress = (label: string, action: string, param: string, field: string): UiNodeSpec =>
  cellOf({ component: "Button", props: { value: label, size: "1", variant: "soft" },
    onPress: action, params: { [param]: { item: field } } })

export const linkCell = (href: string, label: string): UiNodeSpec =>
  cellOf({ component: "Link", props: { href, value: label, size: "2" } })
