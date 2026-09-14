/**
 * The shapes agentd's rows are built from.
 *
 * Two of them are this app's own opinion rather than the framework's, and both
 * come from the design system rather than from taste.
 *
 * A table is drawn at `size="1"`. That one prop is the design system's whole
 * density answer for a dense row: it sets the cell padding to `--space-2` and
 * the table's type to the body size, which is the 32 px row this console is read
 * at. The framework's builder leaves the size to its caller, and every list in
 * this app is dense, so the size is stated once here rather than at eight call
 * sites free to drift from each other.
 *
 * A block is a region title over the one sentence saying what it shows, then its
 * body: not a card, because a card around a table is the one container the
 * design system bans by name, and every block here holds a table. What a card is
 * for, a block with its own identity and its own controls, is the app tile and
 * the config editor, neither of which is in this app.
 */
import { chip, heading, table as tableOf, text, type UiCondition, type UiNodeSpec, type UiRepeatSpec } from "@effect-agent/effect-ui"

/** The key a row is addressed by, in mono, is a row shape and not a one-off: every table here has one. */
export { chip }

/** A list of records, at the density a console is read at. */
export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec): UiNodeSpec => {
  const built = tableOf(headings, cells, repeat)
  return { ...built, props: { ...built.props, size: "1" } }
}

/** A region: what it is, the one sentence saying what it shows, and its body. */
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

/**
 * The title of a screen, over the one sentence saying what the screen is for.
 *
 * Size 4 and not the console's own size 7: that one is the Home screen's, and a
 * screen inside an app that shouted as loudly as the door to the app would make
 * the header and the page it heads the same rank. Nothing here is a card: a
 * screen's title is where the page begins, not a box something else may be
 * dropped into.
 */
export const screenHead = (title: string, description: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [heading(title, { size: "4" }), text(description, { size: "2", color: "gray" })],
})

/** A cell holding one field of the row it is in. */
export const cellOf = (content: UiNodeSpec | readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Table.Cell", children: Array.isArray(content) ? [...content] : [content] })

/**
 * A figure the record may not carry.
 *
 * The guard is the object the figure lives on, never the figure. An agent that
 * has reported nothing has no applied revision, and a revision of zero is a real
 * revision: guarding on the number itself would print "not reported" beside a
 * number that was reported. The object is the field that is absent or present,
 * so it is the field the two readings switch on.
 */
export const figure = (field: string, presence: string, missing: string): UiNodeSpec => cellOf([
  { ...chip(field), visible: { source: { item: presence } } },
  { component: "Text", props: { value: missing, size: "2", color: "gray" },
    visible: { source: { item: presence }, not: true } },
])

/** A word for a fact that is there or is not: the two readings of one boolean. */
export const stated = (where: UiCondition["source"], present: string, absent: string): readonly UiNodeSpec[] => [
  { component: "Text", props: { value: present, size: "2" }, visible: { source: where, equals: true } },
  { component: "Text", props: { value: absent, size: "2", color: "gray" }, visible: { source: where, not: true } },
]

/** A row's identity: the name a person reads, over the id the center addresses it by. */
export const identity = (name: string, id: string): UiNodeSpec => cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1", align: "start" },
  children: [{ component: "Text", item: name }, chip(id)],
})

/** The one move a row makes: it enters the record the row is standing on, and nothing else. */
export const rowPress = (label: string, action: string, param: string, field: string): UiNodeSpec =>
  cellOf({ component: "Button", props: { value: label, size: "1", variant: "soft" },
    onPress: action, params: { [param]: { item: field } } })

/** A row's way into the app that governs what the row names. */
export const linkCell = (href: string, label: string): UiNodeSpec =>
  cellOf({ component: "Link", props: { href, value: label, size: "2" } })
