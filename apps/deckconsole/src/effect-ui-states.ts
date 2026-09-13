/**
 * What a list says before it says anything else: that its source is still being
 * read, that it holds nothing, or that it could not be read at all.
 *
 * `sourceStates` is all three when the source's body *is* the list — its verdict
 * counts the rows the list would render. The deck source is the exception: one
 * payload carries sessions, kinds, and pending asks together, so its verdict
 * counts all of them and can never say "empty" about any one of them. A list fed
 * by it reads its own emptiness from the first row it would render, and takes the
 * verdict's loading and failure notices as they come.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, sourceStatusPath } from "@effect-agent/effect-ui/source-status"

/**
 * "Nothing here" — said only once whatever feeds the list has answered. An empty
 * path and an unanswered one are different things, and a skeleton over an empty
 * notice reads as a contradiction.
 */
export const emptyList = (answered: string, path: string, message: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column" },
  visible: { source: { state: answered }, equals: true },
  children: [{
    component: "Text",
    props: { value: message, color: "gray", size: "2" },
    visible: { source: { state: `${path}/0` }, not: true },
  }],
})

/** The three notices for one list, when the source answers more than that list. */
export const sharedStates = (id: string, path: string, empty: string, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyList(`${sourceStatusPath(id)}/answered`, path, empty), failureNotice(id)]
