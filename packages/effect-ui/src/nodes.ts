import type { UiNodeSpec, UiProps } from "./spec.ts"
import type { UiRepeatSpec } from "./value-spec.ts"
import { emptyRows, stateRows, whenRows } from "./empty-rows.ts"

export const text = (value: string, props: UiProps = {}): UiNodeSpec =>
  ({ component: "Text", props: { value, ...props } })
export const heading = (value: string, props: UiProps = {}): UiNodeSpec =>
  ({ component: "Heading", props: { value, ...props } })
export const field = (name: string, control: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1" }, children: [text(name, { size: "2", color: "gray" }), control] })
export const section = (title: string, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Card", children: [
    { component: "Flex", props: { direction: "column", gap: "3" }, children: [heading(title, { size: "3" }), ...children] },
  ] })
export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], repeat: UiRepeatSpec): UiNodeSpec =>
  ({ component: "Table.Root", props: { variant: "surface" }, children: [
    { component: "Table.Header", children: [
      { component: "Table.Row", children: headings.map((value): UiNodeSpec => ({ component: "Table.ColumnHeaderCell", props: { value } })) },
    ] },
    { component: "Table.Body", repeat, children: [{ component: "Table.Row", children: [...cells] }] },
  ] })
export const cell = (item: string): UiNodeSpec => ({ component: "Table.Cell", item })
export const cellOf = (content: UiNodeSpec | readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Table.Cell", children: Array.isArray(content) ? [...content] : [content] })
export const list = (repeat: UiRepeatSpec, line: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1" }, repeat, children: [line] })
export const line = (item: string, props: UiProps = {}): UiNodeSpec =>
  ({ component: "Text", props, item })
export const chip = (item: string): UiNodeSpec =>
  ({ component: "Code", props: { size: "2" }, item })
export const chipList = (repeat: UiRepeatSpec, item: string): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, repeat, children: [chip(item)] })
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

const pathOf = (repeat: UiRepeatSpec): string => "state" in repeat.source ? repeat.source.state : ""

export const listCard = ({ title, id, empty, headings, cells, repeat }: ListCard): UiNodeSpec =>
  section(title, [emptyRows(id, pathOf(repeat), empty), whenRows(stateRows(pathOf(repeat)), table(headings, cells, repeat))])
