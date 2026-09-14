/**
 * The shapes every screen of this console is built from.
 *
 * Two facts about this app decide all of them. It reads one source that carries
 * four lists, and only an unanswered or a failed read is a fact about that
 * source: the runtime decides "empty" from every array an answer holds, so the
 * verdict of a source carrying four lists can never say that any one of them is
 * empty — it reads ready while the list in front of the operator has nothing in
 * it. Each list therefore asks its own first row, and loading and failure are
 * stated once per screen, above everything they cover.
 *
 * And a block here is a heading and its content, never a card. The shared
 * `section` builder wraps one, and the design system bans a card around a table
 * by name: the table already draws its own surface and its own hairlines, so a
 * card adds a second frame around an edge that is already drawn.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyRows, failureNotice, heading, loadingRows, stateRows, table, text, whenRows } from "@effect-agent/effect-ui"

/** The one source this console reads: the model plane, usage included. */
export const MODEL_SOURCE = "models"

/**
 * A value that stands inside a sentence — a count, a duration, a path. Mono
 * without the chip's ground, so a figure reads as a value and not as a handle
 * to copy. Both forms are size 2 because mono is never a step down from the
 * prose beside it: an id column shrunk to fit is what makes it unreadable.
 */
export const mono = (field: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { variant: "ghost", size: "2", ...props }, item: field })
export const monoBind = (bind: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Code", props: { variant: "ghost", size: "2", ...props }, bind })

/** A block's own sentence, above the block it introduces. */
export const note = (value: string): UiNodeSpec => text(value, { size: "2", color: "gray" })

/** What a reading is counted over, or what a row's answer is: meta, a step down
 *  from the prose it annotates, and never below 12 px. */
export const caption = (value: string): UiNodeSpec => text(value, { size: "1", color: "gray" })

/** A region title and its content. */
export const block = (title: string, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "3" }, children: [heading(title, { size: "3" }), ...children] })

/**
 * One table over one list of the source, and the sentence that stands in for it
 * while it has no rows. The two read the same condition — this list has no
 * first row — so they cannot disagree about whether there is anything, and the
 * table is not drawn over nothing: a header row alone is a table of columns of
 * nothing, which reads as broken rather than as empty.
 */
export const listRows = (headings: readonly string[], cells: readonly UiNodeSpec[], path: string, empty: string, key?: string): readonly UiNodeSpec[] => [
  emptyRows(MODEL_SOURCE, path, empty),
  whenRows(stateRows(path), table(headings, cells, { source: { state: path }, ...(key === undefined ? {} : { key }) })),
]

/** What a screen states about the one read every list on it comes from. */
export const readState: readonly UiNodeSpec[] = [loadingRows(MODEL_SOURCE), failureNotice(MODEL_SOURCE)]
