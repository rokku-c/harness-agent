/**
 * The badges that are a signal rather than a state: a node that is down, a
 * lease that was given back, a request the server refused.
 *
 * Colour belongs to a condition of this shape — true or false, up or not — and
 * never to a value's variant. The language has no value-to-style map, so a
 * coloured badge can only be one the row either is or is not in, which is also
 * why a boolean field is spelled out on both sides: bound, it renders as no
 * text at all.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

/** A fact a row turns on, shown only while the row's own field says so. */
export const itemSignal = (value: string, field: string, color: string, equals: boolean): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color, value }, visible: { source: { item: field }, equals } })
