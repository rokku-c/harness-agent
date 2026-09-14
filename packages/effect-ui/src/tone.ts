import type { UiNodeSpec } from "./spec.ts"

export type Tone = "ok" | "pending" | "failed" | "denied" | "info"

interface ToneStyle {
  readonly variant: string
  readonly color: string
  readonly glyph: string
}

const TONES: Readonly<Record<Tone, ToneStyle>> = {
  ok: { variant: "surface", color: "jade", glyph: "Check" },
  pending: { variant: "soft", color: "amber", glyph: "Hourglass" },
  failed: { variant: "soft", color: "red", glyph: "WarningCircle" },
  denied: { variant: "outline", color: "red", glyph: "Prohibit" },
  info: { variant: "soft", color: "blue", glyph: "Info" },
}

const badge = (tone: Tone, content: UiNodeSpec): UiNodeSpec => {
  const { variant, color, glyph } = TONES[tone]
  return {
    component: "Badge",
    props: { variant, color, highContrast: true, size: "1" },
    children: [{ component: glyph, props: { weight: "bold", size: 12 } }, content],
  }
}

export const toneBadge = (tone: Tone, text: string): UiNodeSpec =>
  badge(tone, { component: "Text", props: { value: text, size: "1" } })

export const toneField = (tone: Tone, field: string): UiNodeSpec =>
  badge(tone, { component: "Text", props: { size: "1" }, item: field })

export const toneWhen = (field: string, equals: string, tone: Tone, text: string): UiNodeSpec =>
  ({ ...toneBadge(tone, text), visible: { source: { item: field }, equals } })
