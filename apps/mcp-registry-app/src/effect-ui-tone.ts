/**
 * The design system's five tones, as the badges a declared view can render.
 *
 * The tone is read off a declared field and never worked out from a string:
 * §3.5 gives the order the four cases are tested in, and a view that invented
 * its own would disagree with the host about the same record.
 *
 * Every tone badge carries `highContrast`, and that is not a preference. A soft
 * badge draws its label in the scale's step 11 over a step-3 ground, which is
 * the one combination in this palette that fails AA in the light appearance
 * (§3.4); the prop is the system's own switch that lifts the label to step 12,
 * and colouring it by hand would be a second palette to keep in step.
 *
 * §3.3 gives each tone a glyph as its first channel, and a declared view cannot
 * name one: a node's component is resolved against `@radix-ui/themes`, which
 * ships no icon family (`catalog.ts`), so the badge's own word is the channel a
 * reader gets beside the colour.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

export type Tone = "ok" | "pending" | "failed" | "denied" | "info"

/** Variant and colour, exactly as §3.3 assigns them. */
const TONE: Readonly<Record<Tone, Readonly<Record<string, unknown>>>> = {
  ok: { variant: "surface", color: "jade" },
  pending: { variant: "soft", color: "amber" },
  failed: { variant: "soft", color: "red" },
  denied: { variant: "outline", color: "red" },
  info: { variant: "soft", color: "blue" },
}

export const toneBadge = (tone: Tone, value: string): UiNodeSpec =>
  ({ component: "Badge", props: { value, highContrast: true, ...TONE[tone] } })

/** The same badge with its word read off the record, for a cell inside a repeat. */
export const toneBadgeOf = (tone: Tone, item: string): UiNodeSpec =>
  ({ component: "Badge", props: { highContrast: true, ...TONE[tone] }, item })
