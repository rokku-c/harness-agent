/**
 * What the board says when a read failed, and when it came back with nothing.
 *
 * Both are the read's own states and are said once for the whole region: the two
 * shapes read one source, and a notice repeated inside each shape would state one
 * failed read twice on one screen.
 *
 * Two empty sentences, and which one is true is the source's decision rather than
 * this view's. A read that carried no rows at all is an empty board, whatever the
 * filter happens to be showing — a filter has nothing to hide from nobody. A read
 * that carried rows while the filter put none of them on screen is a filtered
 * board, and the way out is the filter beside it. The verdict says which of the
 * two happened (`empty` against `ready`), so the view never has to count rows it
 * cannot count.
 *
 * A node's `visible` is one comparison or an `any` of them, never a conjunction,
 * so two facts combine by nesting: the outer node asks the first, the inner asks
 * the second. That nesting is the whole mechanism, and it is why "the read is
 * fine *and* the filter is hiding everything" is two nodes rather than one.
 */

import { emptyMessage, emptyRows, press, row, sourceStatusPath, type UiNodeSpec } from "@effect-agent/effect-ui"
import { hidingSome } from "./effect-ui-filter.ts"

type Visible = UiNodeSpec["visible"]

const status = sourceStatusPath("table")

/** The read's own verdict. Nothing in this file reads a row to decide what to say. */
const failed: Visible = { source: { state: `${status}/state` }, equals: "failed" }
/** A read landed and carried no rows. */
const empty: Visible = { source: { state: `${status}/state` }, equals: "empty" }
/** A read landed and carried rows; a failure and a first paint are both ruled out. */
const ready: Visible = { source: { state: `${status}/state` }, equals: "ready" }
/** A read has landed at some point: the rows on screen are from it, not from the last attempt. */
export const answered: Visible = { source: { state: `${status}/answered` }, equals: true }

/**
 * A node that exists to carry a second condition, since `visible` cannot hold
 * two. A plain column, so nesting one inside another costs nothing on screen.
 */
const under = (visible: Visible, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column" }, visible, children: [...children] })

/**
 * A failed read in the three parts every failure carries: the sentence, the
 * reason the server gave in mono, and the press that repeats the read. What the
 * last successful read delivered stays below it, so a failure costs the reader
 * the current answer and not the last one — and the second line says so, which
 * it can only do once a read has landed.
 *
 * What that line cannot say is when. The verdict keeps the time the read landed
 * as a number and the declaration has no way to format one, so the sentence names
 * the read rather than dating it.
 *
 * "Try again" is a `refresh` and nothing else: an action with no `url` is not a
 * read of its own, so the press re-runs the source's own read — exactly the
 * request that failed, writing exactly what it wrote.
 */
export const readFailure: readonly UiNodeSpec[] = [
  { component: "Callout.Root", props: { color: "red", size: "1", highContrast: true }, visible: failed, children: [
    { component: "Callout.Text", props: { value: "Could not read the task table." } },
    { component: "Callout.Text", props: { value: "Showing the last read that landed." }, visible: answered },
    { component: "Callout.Text", children: [{ component: "Code", props: { size: "1" }, bind: `${status}/error` }] },
  ] },
  row([{ ...press("Try again", "board.retry", undefined, { variant: "soft", size: "1" }), visible: failed }]),
]

/**
 * The board has no task in it. Said the same way in both shapes, filter or no
 * filter, and said only when the verdict agrees: the builder's own guard asks
 * whether a read ever landed, which is the weaker question, and it would have
 * this sentence stand over the rows of a read that has since failed.
 */
export const emptyBoard: UiNodeSpec =
  { ...emptyRows("table", "/table/rows", "No task is on the board. Open New task to add one."), visible: empty }

/**
 * The filter is hiding rows the board does have. The nesting asks the two facts
 * in order, and the read's verdict is asked first because it is the one the view
 * cannot work out for itself.
 */
export const filterEmpty: UiNodeSpec =
  under(ready, [under(hidingSome,
    [emptyMessage("/table/rows", "No task matches this filter. Choose All to see every task.")])])

/** Both sentences the table shape can say, in the order a reader should meet them. */
export const boardEmptiness: readonly UiNodeSpec[] = [emptyBoard, filterEmpty]
