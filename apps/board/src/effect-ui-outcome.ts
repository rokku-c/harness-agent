/**
 * What a write reported, beside the press that made it.
 *
 * A mark reads the write's own answer and never the record it wrote: a created
 * task answers with an id, a deleted one with `ok`, and neither is a field a
 * successful read of the same path would happen to carry — so a mark cannot
 * appear because some read landed on the path a write also writes.
 *
 * The marks sit in a row with the presses, which is what makes an outcome that
 * has not happened yet leave no gap: the form around them is a column, a column
 * stretches what it holds, and a lone badge would paint as a bar across the form.
 * A row whose children are all hidden has no content and takes no height.
 */

import { row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

export const outcome = (presses: readonly UiNodeSpec[], marks: readonly (readonly [string, string])[]): UiNodeSpec =>
  row([
    ...presses,
    ...marks.map(([path, word]): UiNodeSpec =>
      ({ ...toneBadge("ok", word), visible: { source: { state: path } } })),
  ])
