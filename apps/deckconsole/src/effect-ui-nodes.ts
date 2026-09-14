/**
 * The node builders this console is written with.
 *
 * The shapes the framework states for every console are re-exported so a section
 * imports one module rather than two; the rest are this page's own: a key, a
 * screen door, and the three readouts that pair a failure with the press that
 * repeats it.
 *
 * The readouts exist because `design-system.md` §9 refuses an error without a
 * retry on any surface, and because a retry has to sit where the failure is read
 * or the reader is left looking for the control that caused it. Each keeps the
 * framework's own arrangement — a readout and its guard are one path, so nothing
 * paints an empty red box before the first press answers — and adds the one
 * press that repeats the request.
 */
import type { UiActionParam, UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyNotice, failureBadge, failureCallout, failureNotice, loadingRows, press, row, sourceStatusPath } from "@effect-agent/effect-ui"

export {
  cell, cellOf, emptyMessage, emptyRows, field, line, loadingRows, press, row, section, stateBadge,
  stateRows, table, text, whenRows,
} from "@effect-agent/effect-ui"

/** An identifier addresses a record; it is a key, so it wears the code chip, never the first cell. */
export const code = (item: string): UiNodeSpec => ({ component: "Code", item })

/** The same chip over a value the view holds rather than a row's own field. */
export const codeAt = (bind: string): UiNodeSpec => ({ component: "Code", bind })

/** The press that repeats a request. `Try again` is the design system's own word for it (§9). */
export const tryAgain = (onPress: string, params?: Readonly<Record<string, UiActionParam>>): UiNodeSpec =>
  press("Try again", onPress, params, { variant: "soft", size: "1" })

/**
 * A door to another screen of this app.
 *
 * `size="1"` and `variant="soft"` are the design system's own door, the shape it
 * gives a screen menu (§10.2.5). A door leads somewhere; the press that does a
 * screen's own work is the solid one, and a row of solid presses leaves the page
 * with no way to say which of them is the page's point.
 */
export const door = (label: string, onPress: string): UiNodeSpec =>
  press(label, onPress, undefined, { variant: "soft", size: "1" })

/**
 * The doors, in their own row and their own group.
 *
 * `wrap` because this row is the width of a phone as well as of a desktop, and
 * an unwrapped one pushes the last door past the edge. The `aria-label` is the
 * design system's own name for the group (§10.2.5): without it a screen reader
 * reads three unrelated buttons where the page means three destinations.
 */
export const doorRow = (label: string, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "2", wrap: "wrap", "aria-label": label }, children: [...children] })

/** A refusal as a chip beside its retry, for a section with no room for the sentence. */
export const readout = (bind: string, retry: UiNodeSpec): UiNodeSpec => row([failureBadge(bind), retry])

/**
 * The same refusal at full width, where the sentence the server sent is the point.
 *
 * A column rather than the framework's `row`, so the sentence keeps the width it
 * was written for and the press sits under it sized to its own label; a row would
 * put a button in the middle of a paragraph.
 */
export const failureReadout = (bind: string, retry: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "2", align: "start" },
    visible: { source: { state: bind } }, children: [failureCallout(bind), row([retry])] })

/**
 * A source that could not be read, and the press that reads it again.
 *
 * Guarded on the source's own verdict and not on its error text: the verdict is
 * what the runtime writes and the text is whatever the server said, and a retry
 * offered for a read that is merely empty is a control that tells the operator
 * the page is broken when it is not (H12).
 */
export const sourceRead = (id: string, retry: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "2", align: "start" },
    visible: { source: { state: `${sourceStatusPath(id)}/state` }, equals: "failed" },
    children: [failureNotice(id), row([retry])] })

/** Loading, empty, and failed-with-its-retry, in the order a list wants them. */
export const sourceStatesRetry = (id: string, empty: string, retry: UiNodeSpec, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyNotice(id, empty), sourceRead(id, retry)]
