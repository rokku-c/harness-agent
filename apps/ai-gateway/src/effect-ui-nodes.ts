/**
 * The shapes every block of the gateway console is built from.
 *
 * Shared rather than repeated per section: the cell, the chip, the table, and
 * the three states every list has. What differs between sections — which
 * columns, which fields — lives with the section it belongs to. The shapes the
 * framework has an opinion about are re-exported from it rather than restated.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, table as tableOf } from "@effect-agent/effect-ui"

export { cell, cellOf, heading, row, section, text } from "@effect-agent/effect-ui"

/** The one source this page reads: the model plane, usage included. */
export const MODEL_SOURCE = "models"

/**
 * A field that is a handle rather than prose: a provider id, a rule id, a
 * request id, a served path. An operator copies it into a request header or
 * matches it against a log rather than reading it, so it renders as a code chip
 * instead of as a cell of text.
 */
export const chip = (field: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", variant: "soft", ...props }, item: field })

/**
 * A fact worth flagging, rendered only while it is true.
 *
 * Colour belongs to a condition of this shape — on or off, failed or not — and
 * never to a value's variant: the language has no value-to-style map, so a
 * coloured badge can only be one the page is in or is not in. A state with
 * several spellings binds its badge and takes the design system's default.
 */
export const signal = (value: string, path: string, color: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color, value }, visible: { source: { state: path } } })

/**
 * A table over one source's list, named rather than composed: this gateway has
 * exactly one source, so its tables say which list they read. The framework's
 * table owns the shape; `key` names the field a list sits under.
 */
export const table = (headings: readonly string[], cells: readonly UiNodeSpec[], source: string, key?: string): UiNodeSpec =>
  tableOf(headings, cells, { source: { state: source }, ...(key === undefined ? {} : { key }) })

/**
 * The source's own read, stated once on each screen that draws its lists.
 *
 * Every table reads the one `/models` answer, so loading and failed are facts
 * about that read rather than about any list: repeated per list they would put
 * four identical callouts on one screen for one failure. A screen is a surface,
 * so each screen says it once for the lists it holds — and on the first screen
 * the figures sit under it too, because before the first answer their zeros read
 * as "no traffic" when what they mean is that nothing has been read yet.
 *
 * A list's own emptiness is not here. This source carries four lists, so its
 * verdict cannot say "empty" about any one of them: it stays ready while any of
 * them has a row, and a verdict of ready over an empty table is a bare header.
 * Each section asks its own first row instead, with the framework's `emptyRows`
 * and this source's id — there is no second shape between them to restate.
 */
export const sourceVerdict: readonly UiNodeSpec[] = [loadingRows(MODEL_SOURCE, 2), failureNotice(MODEL_SOURCE)]
