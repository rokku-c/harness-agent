/**
 * The shapes this console's screens are built from.
 *
 * A field is its label above its control, a section is a card with a heading, a
 * list of records is a table: those are the framework's opinions, stated once in
 * `@effect-agent/effect-ui`, and re-exported here so a screen of this app names
 * one place for the shapes it did not invent.
 *
 * What is left below is this app's own, and it is two opinions. The first is
 * which text role a value wears: every id, operation name, count and timestamp
 * here is set in the mono role, because a column of values only lines up when
 * the face's digits are one width, and a proportional face is what makes an id
 * column read as prose. The second is which of the design system's five tones a
 * badge carries — one table, in one place, so no screen decides for itself that
 * an amber badge means something else.
 */

import type { UiNodeSpec, UiVisibilitySpec } from "@effect-agent/effect-ui"

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

/** The design system's five tones. A tone is one of these words and nothing else. */
export type Tone = "ok" | "pending" | "failed" | "denied" | "info"

/**
 * Variant and colour together, because a tone is a pair and not two independent
 * choices: the design system separates a refused verdict from a failed
 * operation by fill as well as by word, so `denied` is an outline where `failed`
 * is a soft tint, and picking one channel per screen is how the two collapse
 * into one another.
 */
const TONES: Readonly<Record<Tone, { readonly variant: string; readonly color: string }>> = {
  ok: { variant: "surface", color: "jade" },
  pending: { variant: "soft", color: "amber" },
  failed: { variant: "soft", color: "red" },
  denied: { variant: "outline", color: "red" },
  info: { variant: "soft", color: "blue" },
}

/**
 * One tone, in the badge that carries it, gated on the comparison that decides
 * it. `highContrast` is not decoration: it is what moves a badge's label off the
 * neutral ramp's step 11, which fails AA on the light appearance in two of the
 * four tone hues, and onto step 12, which clears it everywhere.
 */
export const toneBadge = (label: string, tone: Tone, visible: UiVisibilitySpec): UiNodeSpec =>
  ({ component: "Badge", props: { ...toneProps(tone), value: label }, visible })

/**
 * The tone's variant and colour, for the badge whose guard is stated by the
 * block around it instead of by a comparison of its own: a strip that filters
 * its rows once does not restate that filter on every badge inside them.
 */
export const toneProps = (tone: Tone): Readonly<Record<string, unknown>> =>
  ({ ...TONES[tone], highContrast: true })

/**
 * A tone over one of a row's own fields, against a literal the caller names.
 * A tone is never computed from a string a view interprets, and the label is an
 * argument rather than the field's value: what a reader is shown is a word, and
 * `fail` is not one.
 */
export const itemTone = (field: string, equals: string | boolean, label: string, tone: Tone): UiNodeSpec =>
  toneBadge(label, tone, { source: { item: field }, equals })

/** A tone over view state: a fact the page holds rather than one a row does. */
export const stateTone = (path: string, equals: string | boolean, label: string, tone: Tone): UiNodeSpec =>
  toneBadge(label, tone, { source: { state: path }, equals })
