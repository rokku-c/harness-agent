/**
 * The tones a board surface carries, one badge each.
 *
 * Which tone a row wears is a function of the server's own fields and of nothing
 * else: a `failure` is `failed`, an unfinished `waits` is `pending`, a write's
 * own answer is `ok`. No builder here inspects a value, either — each takes the
 * guard its caller read off the record — because a tone inferred from the text
 * of a field is a tone that disagrees with the host the first time the host
 * renames something.
 *
 * Colour is never a badge's only channel: every word below names its tone. The
 * glyph the design system puts beside it is the channel that is missing, and it
 * is missing for a reason worth writing down — a node's component name resolves
 * against `@radix-ui/themes` and nothing else, so the icon family's names would
 * draw `Unknown component: WarningCircle` in place of the badge, and a tone with
 * its word and its fill is a surface where an undrawn node is not.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"

type Visible = UiNodeSpec["visible"]

/** A step in flight or unanswered: a task waiting on what it depends on. */
export const pendingBadge = (word: string, visible: Visible): UiNodeSpec =>
  ({ component: "Badge", props: { value: word, color: "amber", variant: "soft", highContrast: true }, visible })

/** An operation that errored: a task whose last run stopped. */
export const failedBadge = (word: string, visible: Visible): UiNodeSpec =>
  ({ component: "Badge", props: { value: word, color: "red", variant: "soft", highContrast: true }, visible })

/** The console's own answer is yes: a write that landed. */
export const okBadge = (word: string, visible: Visible): UiNodeSpec =>
  ({ component: "Badge", props: { value: word, color: "jade", variant: "surface", highContrast: true }, visible })
