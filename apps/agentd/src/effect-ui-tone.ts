/**
 * The tones this app is allowed to draw, and the field each one is a function of.
 *
 * The design system fixes the palette to five and forbids choosing one per
 * screen; a tone is the first of four declared cases a field matches, and
 * `failed` and `denied` share red on purpose, separated by fill and by word. A
 * tone is never computed from a free-text string and never inferred from a
 * component name, so every use here names the field it reads.
 *
 * What is deliberately *not* here is a colour for a state name. A machine's
 * `status` is a word the machine chose, and a launch's `state` is a phase, and
 * neither is one of the four cases: the first is a claim the server's own
 * observation is there to check, the second is spelled out per value by the
 * console. Those render through the framework's colourless `stateBadge`, which
 * ships no value the row is not in and does not break the day the server spells
 * a new one.
 *
 * The design system asks a tone to arrive on three channels at once: a glyph, a
 * word, a colour. Two of the three are here. A declared node can name any export
 * of `@radix-ui/themes`, and that library's only glyphs are its own control
 * ornaments; the icon family the console uses is Phosphor, which nothing in a
 * declared view can reach. A tone therefore renders as its word in its colour,
 * which is the channel that survives a reader who cannot see colour at all.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

/**
 * One badge, in one tone.
 *
 * `highContrast` is on every tone and not chosen per badge: a soft tone draws
 * its label in step 11 over a step-3 ground, which is the one combination that
 * fails AA in the light appearance, and the system's own switch is what moves it
 * to step 12. A tone that was legible only where somebody remembered to ask for
 * it would fail on the first tone added after them.
 */
const badge = (value: string, props: Readonly<Record<string, unknown>>): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", highContrast: true, value, ...props } })

/** Healthy, current, allowed. Quiet on purpose: thirty current rows are not thirty alarms. */
export const ok = (value: string): UiNodeSpec => badge(value, { variant: "surface", color: "jade" })
/** An unanswered step: a decision outstanding, or a step in flight. */
export const pending = (value: string): UiNodeSpec => badge(value, { color: "amber" })
/** An error: a call that failed, a source that could not be read. */
export const failed = (value: string): UiNodeSpec => badge(value, { color: "red" })
/** A policy verdict that refused. Same red as `failed`, told apart by fill and by word. */
export const denied = (value: string): UiNodeSpec => badge(value, { variant: "outline", color: "red" })
/** A literal that tells a row apart from its neighbours and is neither health nor a problem. */
export const info = (value: string): UiNodeSpec => badge(value, { color: "blue" })

/** The same badge drawn only while the row's own field says so. */
export const whenTrue = (tone: UiNodeSpec, field: string): UiNodeSpec =>
  ({ ...tone, visible: { source: { item: field }, equals: true } })

/**
 * The same badge for the other reading of a boolean. Guarded on "not true"
 * rather than on "equals false" so a record that never sent the field reads as
 * the negative case, which for presence is the true reading: a node that has
 * never announced is offline, not unknown.
 */
export const whenFalse = (tone: UiNodeSpec, field: string): UiNodeSpec =>
  ({ ...tone, visible: { source: { item: field }, not: true } })

/** A literal the row carries, in the tone for a literal. */
export const infoOf = (field: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "blue", highContrast: true }, item: field })
