/**
 * The state filter, and the conditions every surface reads off it.
 *
 * "All" is not an equality a row can be tested against, so a row that survives
 * the filter is the two cases as alternatives: the filter is All, or the filter
 * *is* the row's own state. The second compares the row's field against the
 * filter path rather than against a value copied out of it, so the chips and the
 * rows read one piece of state and cannot come to disagree about which row is on
 * screen.
 *
 * `hidingSome` is the half the emptiness notice is written against, kept here
 * beside the control that sets the state it reads. Its other half is not "the
 * filter is All" but the source's own verdict, which the notice asks for itself:
 * an empty board reads as an empty board whatever the filter is showing.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { stateOptions } from "./effect-ui-states.ts"

/** One chip. Its label is a child, because `value` is the item's own value. */
const chip = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value },
    children: [{ component: "Text", props: { value: label } }] })

export const stateFilter: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/filter",
  children: [chip("all", "All"), ...stateOptions.map((option) => chip(option.value, option.label))],
}

/** A row is drawn while this holds. It is the table body's own guard. */
export const matchesFilter: UiNodeSpec["visible"] = {
  any: [
    { source: { state: "/filter" }, equals: "all" },
    { source: { item: "state" }, equals: { state: "/filter" } },
  ],
}

export const hidingSome: UiNodeSpec["visible"] = { source: { state: "/filter" }, equals: "all", not: true }
