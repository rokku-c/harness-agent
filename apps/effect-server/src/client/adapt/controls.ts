/**
 * The components that hold a value, and the prop each one holds it on.
 *
 * Which components are controls is a fact about the design system, and the prop
 * is the half of it that can be observed from the outside: a component that
 * keeps its value on `value` hears it change on `onValueChange`, and one that
 * keeps it on `checked` hears `onCheckedChange`. Writing the handler name beside
 * the prop would be a second copy of one fact, free to drift from the first, so
 * only the prop is written down and the handler is derived from it, where the
 * two cannot disagree.
 *
 * There is one exception to the derivation, and it is not a second fact. A
 * control that reports the DOM event its own input raised is a control whose
 * change prop is `onChange`: a text field hands over the event rather than the
 * value it now holds, and the library names the prop after that event. So
 * "reports its own DOM event" and "changes on `onChange`" are one fact about a
 * component, which is why one set of names decides both — the handler is
 * `onChange` exactly when the control reports its own DOM event, so a third text
 * field is named in that set once and derives both answers.
 *
 * That is the whole reason a hand-written `{ prop, event }` pair was replaced by
 * a derivation with one named exception rather than by a derivation alone: the
 * pair could name `onValueChange` for a text field, and nothing about the value
 * `value` would catch it. This did happen — Radix's `TextField.Root` takes
 * `onChange`, and an input whose `value` has no handler that writes it back is
 * read-only to React, which silently drops what the reader types.
 */

import type { Binding } from "./contract.ts"

/** A control is the export that holds the value, which for a compound one is its `.Root`. */
const CONTROLS = new Map<string, string>([
  ["TextField.Root", "value"],
  ["TextArea", "value"],
  ["Select.Root", "value"],
  ["SegmentedControl.Root", "value"],
  ["RadioGroup.Root", "value"],
  ["Slider", "value"],
  ["Switch", "checked"],
  ["Checkbox", "checked"],
])

/** The two that report the event their own input raised rather than the value it now holds. */
const DOM_EVENT = new Set(["TextField.Root", "TextArea"])

const capitalised = (prop: string): string => prop.charAt(0).toUpperCase() + prop.slice(1)

/** How this name keeps its value, or nothing if the name is not a control. */
export const binding = (name: string): Binding | undefined => {
  const prop = CONTROLS.get(name)
  if (prop === undefined) return undefined
  const dom = DOM_EVENT.has(name)
  return { prop, handler: dom ? "onChange" : `on${capitalised(prop)}Change`, dom }
}

/**
 * The value out of whatever the handler was called with.
 *
 * A DOM-reporting control is handed the event, and the value it carries is on
 * that event's target. Everything else is handed the value itself. The old test
 * for this compared the prop name against `checked`, which guessed at the shape
 * of the argument rather than knowing what the component sends.
 */
export const read = (next: unknown, binding: Binding): unknown => {
  if (!binding.dom) return next
  const target = (next as { target?: { value?: unknown } } | undefined)?.target
  return target === undefined ? next : target.value
}
