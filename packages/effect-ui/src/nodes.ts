/**
 * The node vocabulary every console was writing for itself.
 *
 * A view names @radix-ui/themes components directly; what a console kept
 * restating was the handful of shapes it has an opinion about — a field is its
 * label above its control, a section is a card with a heading, a list of records
 * is a table. Seven consoles had each grown a copy of exactly this file, so the
 * opinion lives here once and a console adds only what is its own.
 *
 * Nothing here invents a component: each builder returns the design system's own
 * component name with that component's own props.
 */

import type { UiNodeSpec } from "./spec.ts"
import type { UiRepeatSpec } from "./value-spec.ts"
import { emptyRows } from "./empty-rows.ts"

export const text = (value: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Text", props: { value, ...props } })
export const heading = (value: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Heading", props: { value, ...props } })
/** A field is its label above the control, never beside it. */
export const field = (name: string, control: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1" }, children: [text(name, { size: "2", color: "gray" }), control] })
/** A section is a card with a heading; a page of bare headings is not a page. */
export const section = (title: string, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Card", children: [
    { component: "Flex", props: { direction: "column", gap: "3" }, children: [heading(title, { size: "3" }), ...children] },
  ] })
/**
 * A list of records is a table, and the repeat sits on the body: it repeats the
 * body's children, so its one row becomes one row per record.
 */
export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec): UiNodeSpec =>
  ({ component: "Table.Root", props: { variant: "surface" }, children: [
    { component: "Table.Header", children: [
      { component: "Table.Row", children: headings.map((value): UiNodeSpec => ({ component: "Table.ColumnHeaderCell", props: { value } })) },
    ] },
    { component: "Table.Body", repeat, children: [{ component: "Table.Row", children: [...cells] }] },
  ] })
export const cell = (item: string): UiNodeSpec => ({ component: "Table.Cell", item })
/**
 * A cell holding something other than a row's own field — a stack of them, when
 * one column carries the name a person reads over the id the server addresses
 * the record by. The nodes are handed over as they are rather than wrapped:
 * whether several of them stack or sit in a row is the caller's layout, not a
 * rule this vocabulary has.
 */
export const cellOf = (content: UiNodeSpec | readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Table.Cell", children: Array.isArray(content) ? [...content] : [content] })
/** A list held in one field: a column of one-line entries. An empty item path is the element itself. */
export const list = (repeat: UiRepeatSpec, line: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1" }, repeat, children: [line] })
export const line = (item: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Text", props, item })
/**
 * An identifier that is a row's content rather than its name — a server a set
 * contains, an agent a binding names. It reads as code, because a key is what it
 * is; where a record has a name, the name is what leads its row.
 */
export const chip = (item: string): UiNodeSpec =>
  ({ component: "Code", props: { size: "2" }, item })
/**
 * The ids a record holds, one chip per line. The stack is aligned to its start,
 * because a column stretches what it holds and a stretched key paints as a bar
 * across the cell rather than as the chip it is.
 */
export const chipList = (repeat: UiRepeatSpec, item: string): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, repeat, children: [chip(item)] })
/**
 * The state a record is in, named by the value itself. One badge, no colour:
 * the colourless form is the rule, since a state name is an enumeration and
 * colour is for signals — an allowance, a refusal, a read that failed.
 */
export const stateBadge = (item: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft" }, item })

export interface ListCard {
  readonly title: string
  readonly id: string
  readonly empty: string
  readonly headings: readonly string[]
  readonly cells: readonly UiNodeSpec[]
  readonly repeat: UiRepeatSpec
}

/** The rows a table would render, read off the repeat it is declared with. */
const pathOf = (repeat: UiRepeatSpec): string => "state" in repeat.source ? repeat.source.state : ""

/**
 * A card holding one table from one source, with the list's own emptiness above
 * its rows. The source's read state is deliberately not stated here: the section
 * that owns the source says it once, above every list that read feeds.
 */
export const listCard = ({ title, id, empty, headings, cells, repeat }: ListCard): UiNodeSpec =>
  section(title, [emptyRows(id, pathOf(repeat), empty), table(headings, cells, repeat)])
