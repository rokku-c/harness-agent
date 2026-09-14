/**
 * The five tones, as the badge each one is (§3.3).
 *
 * Colour is the third channel here, never the first: every badge carries the
 * word as well, so a reader who cannot see colour reads the same fact. The
 * shapes are the design system's own — `surface` for `ok`, `soft` for the three
 * tints, `outline` for `denied`, which is how `failed` and `denied` stay apart
 * while sharing red — and `highContrast` is on all of them because §3.4 measured
 * a soft badge's step-11 label against a tinted ground and found it failing AA
 * in the light appearance.
 *
 * A tone is never inferred. Each node here is guarded on the one field that
 * declares it, so a row whose status is not one of the two an operator can set
 * renders no badge rather than the nearest one.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

const TONES = {
  ok: { variant: "surface", color: "jade" },
  pending: { variant: "soft", color: "amber" },
  failed: { variant: "soft", color: "red" },
  denied: { variant: "outline", color: "red" },
  info: { variant: "soft", color: "blue" },
} as const

export type Tone = keyof typeof TONES

export const toneBadge = (tone: Tone, word: string): UiNodeSpec =>
  ({ component: "Badge", props: { ...TONES[tone], highContrast: true, value: word } })

/**
 * The same badge with the value itself as the word, for a column whose whole
 * meaning is "what kind of thing is this" — a kind, an era, an endpoint. §3.5's
 * fourth case: the tone is fixed by the column and read by the reader, and the
 * data supplies only the word, so no tone is ever inferred from a string.
 */
export const toneField = (tone: Tone, field: string): UiNodeSpec =>
  ({ component: "Badge", props: { ...TONES[tone], highContrast: true }, item: field })

/**
 * The same badge, shown only where a row's own field says so.
 *
 * A repeat item is a value like any other, so "this principal is active" is the
 * language's own comparison and not a second vocabulary. Two of these side by
 * side is how one column carries two states without a conditional the view
 * language does not have.
 */
export const toneFor = (field: string, value: string, tone: Tone, word: string): UiNodeSpec =>
  ({ ...toneBadge(tone, word), visible: { source: { item: field }, equals: value } })
