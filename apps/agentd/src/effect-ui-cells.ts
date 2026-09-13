/**
 * How a row renders what it carries: the plain cell, the chip for a key, the one
 * badge for a value, and the list of badges or chips a cell holds.
 *
 * A row leads with what it is and keeps its keys as chips, because an id is
 * something an operator types into an inspection or correlates against a log —
 * not something anyone reads a column of.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

/** An item's own field, rendered as it arrives. */
export const cell = (field: string): UiNodeSpec => ({ component: "Table.Cell", item: field })
export const cellOf = (children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Table.Cell", children: [...children] })

/** An id as a chip: the row's own key, and the same key as view state holds it. */
export const chip = (field: string): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", variant: "soft" }, item: field })
export const boundChip = (bind: string): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", variant: "soft" }, bind })

/**
 * A row's identity: the name an operator reads, over the id the center
 * addresses it by. A machine has a name of its own, so its id belongs under it
 * rather than in a column beside it. The stack is aligned to its start, because
 * a column stretches what it holds and a stretched key would paint as a bar
 * under the name rather than as the chip it is.
 */
export const identity = (name: string, id: string): UiNodeSpec => cellOf([
  { component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name }, chip(id),
  ] },
])

/**
 * The one badge for a value a row carries — a state, a name, a transport.
 *
 * No `color`: the palette is for signals, and a value that is one of several
 * spelled states has no worse one to name. A badge per *possible* state would
 * ship every state the row is not in, and break the moment the server spells a
 * new one.
 */
export const badgeOf = (field: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft" }, item: field })

/** That badge in a cell of its own. */
export const badgeCell = (field: string): UiNodeSpec => cellOf([badgeOf(field)])

/**
 * A figure the row may not have. A deployment an agent has not acknowledged has
 * no applied revision, and a blank cell reads as one that is zero; the row says
 * which of the two it is.
 */
export const reported = (field: string): UiNodeSpec => cellOf([
  { component: "Text", item: field },
  { component: "Text", props: { value: "not reported", size: "2", color: "gray" },
    visible: { source: { item: field }, not: true } },
])

/**
 * An entry of a list that holds strings rather than records — a set's server
 * ids, a plan's changes. Such an entry names itself, which the language spells
 * as the empty item path.
 */
export const stringEntry = (): UiNodeSpec => ({ component: "Badge", props: { variant: "soft" }, item: "" })

/**
 * A list one row carries, as a cell: a badge or chip per entry. The repeat sits
 * on the row's own item, so each row lists its sets, its artifacts, its
 * placements — not the first row's, repeated.
 */
export const listed = (field: string, entry: readonly UiNodeSpec[]): UiNodeSpec => cellOf([
  { component: "Flex", props: { gap: "1", wrap: "wrap", align: "center" },
    repeat: { source: { item: field } }, children: [...entry] },
])
