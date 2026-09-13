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

import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, sourceStatusPath } from "@effect-agent/effect-ui/source-status"

/**
 * Whether the list fed by this path has a first row. One predicate, read two
 * ways: the notice below says "nothing here" when there is none, and the list
 * itself is drawn only when there is one — because a header row over no rows is
 * a table saying there are columns of nothing, and the notice already says the
 * true thing.
 */
const firstRow = (path: string): UiCondition => ({ source: { state: `${path}/0` } })

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
    visible: { ...firstRow(path), not: true },
  }],
})

/** What acts on a list — the list itself, or the press that empties it — while
that list has a row: a header row over no rows is a table saying there are
columns of nothing, and "close all sessions" under the notice that none is open
is an offer to close nothing. */
export const whenRows = (path: string, node: UiNodeSpec): UiNodeSpec =>
  ({ ...node, visible: firstRow(path) })

/** The three notices for one list, when the source answers more than that list. */
export const sharedStates = (id: string, path: string, empty: string, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyList(`${sourceStatusPath(id)}/answered`, path, empty), failureNotice(id)]
