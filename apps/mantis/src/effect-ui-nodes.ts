/**
 * The shapes this console's screens are built from.
 *
 * A field is its label above its control, a section is a card with a heading, a
 * list of records is a table: those are the framework's opinions, stated once in
 * `@effect-agent/effect-ui`, and re-exported here so a screen of this app names
 * one place for the shapes it did not invent.
 *
 * What is left below is this app's own, and it is one opinion: which text role a
 * value wears. Every id, operation name, count and timestamp here is set in the
 * mono role, because a column of values only lines up when the face's digits are
 * one width, and a proportional face is what makes an id column read as prose.
 *
 * The design system's five tones are deliberately not here. A tone is one table
 * for every app, declared in `@effect-agent/effect-ui`'s `tone.ts`, and a screen
 * that draws one names that builder directly — a table per app is how one app's
 * amber comes to mean something another app's amber does not.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"

export {
  cellOf, emptyMessage, emptyRows, failureCallout, failureNotice, field, heading, itemRows,
  loadingRows, press, region, row, section, sourceStates, stateBadge, stateRows, table, text, whenRows,
} from "@effect-agent/effect-ui"

/** A value read off a row: the id a press addresses it by, the count it holds. */
export const rowValue = (item: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", ...props }, item })

/** The same, read off view state: a value the page holds rather than one a row holds. */
export const stateValue = (path: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", ...props }, bind: path })

/** A cell whose content is a key rather than a name. */
export const keyCell = (item: string): UiNodeSpec =>
  ({ component: "Table.Cell", children: [rowValue(item)] })
