/**
 * The region itself: one element, rendered once, and never drawn.
 *
 * It is `VisuallyHidden` because an announcement is not a thing to look at — the
 * operator reading the screen already has the fact in front of them, and the one
 * who needs it said aloud is the one who cannot see it. `aria-atomic` is what
 * makes the sentence the unit rather than the changed words: `Inbox` refined to
 * `Inbox, 3 waiting` is read as one sentence, not as "three waiting" appended to
 * something the listener never heard.
 *
 * `role="status"` and `aria-live="polite"` say the same thing twice, which is
 * deliberate: the role is what a screen reader with no ARIA live support falls
 * back to, and the attribute is what the rest use. What is in it is
 * `console-live.ts`'s whole subject.
 */

import * as React from "react"
import { VisuallyHidden } from "@radix-ui/themes"
import { useLiveSentence } from "./console-live.ts"

export const ConsoleLiveRegion = () => {
  const sentence = useLiveSentence()
  return <VisuallyHidden><div role="status" aria-live="polite" aria-atomic="true">{sentence}</div></VisuallyHidden>
}
