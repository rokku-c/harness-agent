/**
 * A line of nodes that the design system sizes to their own content.
 *
 * A `Flex direction="column"` stretches whatever it holds on the cross axis, and
 * a page and every card's inner stack is one. The design system sizes a `Badge`,
 * a `Code` chip and a `Button` to their content, so put straight into a column
 * each grows to the container's width: a seven-character badge paints as a
 * banner across the card, a key paints as a bar under the name it belongs to,
 * and a lone press spans the form. Laid out in a row they keep the size they
 * were given.
 *
 * Nothing else needs a row. Text, callouts, fields, selects and tables are meant
 * to fill the width they are handed, and wrapping one only narrows it.
 *
 * A row whose children are all hidden has no content and takes no height, so a
 * readout guarded by `visible` can live in one without leaving a gap behind —
 * which is why an outcome badge belongs here rather than under its own guard.
 */
import type { UiNodeSpec } from "./spec.ts"

export const row = (children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { gap: "2", wrap: "wrap", align: "center" },
  children: [...children],
})
