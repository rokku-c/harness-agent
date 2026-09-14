/**
 * The five semantic tones (§3.3), each rendering through all three of its
 * channels at once: a glyph, a word, and a colour.
 *
 * Four apps had each written this table for itself, and each had written the
 * same paragraph beside it explaining which channel was missing. The missing one
 * was the glyph: a node's component name resolves against the design system's
 * exports, and that library ships no icon family, so a tone could only ever be
 * its word and its colour — which is the channel a reader who cannot see colour
 * already had. The console's adaptation layer resolves the icon family's names
 * from a closed table now, so a tone declared here draws the glyph §3.3 gives it.
 *
 * A tone is never inferred. §3.5 fixes it as the first of four declared cases a
 * field matches and forbids the rest — never from free text, never from a node's
 * component name, never per screen — so every builder below takes the tone and
 * reads nothing to find it.
 *
 * The fill is what separates the two reds: `failed` is soft, `denied` is
 * outline, and their glyphs and words differ again. `highContrast` is on every
 * badge because §3.4 measured a soft badge's step-11 label over a step-3 ground
 * and found it failing AA in the light appearance; a tone that were legible only
 * where somebody remembered to ask for it would fail on the first tone added
 * after them.
 */

import type { UiNodeSpec } from "./spec.ts"

export type Tone = "ok" | "pending" | "failed" | "denied" | "info"

interface ToneStyle {
  readonly variant: string
  readonly color: string
  /** §8's one glyph for this concept. The host's closed table is what resolves it. */
  readonly glyph: string
}

const TONES: Readonly<Record<Tone, ToneStyle>> = {
  ok: { variant: "surface", color: "jade", glyph: "Check" },
  pending: { variant: "soft", color: "amber", glyph: "Hourglass" },
  failed: { variant: "soft", color: "red", glyph: "WarningCircle" },
  denied: { variant: "outline", color: "red", glyph: "Prohibit" },
  info: { variant: "soft", color: "blue", glyph: "Info" },
}

/**
 * The word is a child rather than the badge's `value`, and it has to be: a node
 * that declares children stops rendering `value` as its content (§11.1), so a
 * badge carrying a glyph would silently lose its word. The glyph is `bold`/12
 * because §8 fixes a badge's glyph that way and a badge's own label is 12 px, so
 * the two are sized as a pair and move together or not at all.
 */
const badge = (tone: Tone, content: UiNodeSpec): UiNodeSpec => {
  const { variant, color, glyph } = TONES[tone]
  return {
    component: "Badge",
    props: { variant, color, highContrast: true, size: "1" },
    children: [{ component: glyph, props: { weight: "bold", size: 12 } }, content],
  }
}

/** One tone, named. */
export const toneBadge = (tone: Tone, text: string): UiNodeSpec =>
  badge(tone, { component: "Text", props: { value: text, size: "1" } })

/**
 * The same badge for a column whose meaning *is* the value it carries — a kind,
 * an era, an endpoint. §3.5's fourth case: the tone is fixed by the column and
 * the data supplies only the word, so no tone is inferred from a string.
 */
export const toneField = (tone: Tone, field: string): UiNodeSpec =>
  badge(tone, { component: "Text", props: { size: "1" }, item: field })

/**
 * The same badge, drawn only where the row's own field says so. A repeat item is
 * a value like any other, so "this principal is active" is the language's own
 * comparison and not a second vocabulary.
 */
export const toneWhen = (field: string, equals: string, tone: Tone, text: string): UiNodeSpec =>
  ({ ...toneBadge(tone, text), visible: { source: { item: field }, equals } })
