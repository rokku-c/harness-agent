/**
 * The Task screen: the record a row opened, and the two writes that act on it.
 *
 * The id comes from the address rather than from the press that arrived here, so
 * a press and a pasted link are the same act with the same one read — the read
 * the screen names as its own entry (`board.load`). A press that reads first and
 * a screen that reads on entry would be two reads of one record.
 *
 * Save sends every field on screen. A partial merge that held one back would be
 * the form disagreeing with the record it is showing, and the field it held back
 * would be the one the operator had just changed.
 *
 * The record stays where it is after a successful delete, and the reason is the
 * layer's rather than a preference: `opens` runs whether the call succeeded or
 * failed, so a screen cannot be left only on success — and clearing `/selected`
 * would take the confirmation with it, because the mark that says `Deleted`
 * lives in the row of presses that deleted it. What the operator gets is the
 * record still on screen, a `Deleted` mark beside the press, and a board that no
 * longer lists it.
 */

import { heading, NAV_ROOT, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, memo, picker, refusal } from "./effect-ui-fields.ts"
import { outcome } from "./effect-ui-outcome.ts"

/**
 * The sentence for an address that names no task, guarded on the address rather
 * than on the record being absent: the record is also absent for as long as the
 * read takes and for good when it failed, and "pick one from the board" is the
 * wrong thing to say to a reader who did pick one and is looking at the reason
 * it is not here.
 */
const nothingOpen: UiNodeSpec = {
  component: "Text",
  props: { value: "No task is open. Pick one from the board.", size: "2", color: "gray" },
  visible: { source: { state: `${NAV_ROOT}/taskId` }, not: true },
}

const record: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: { source: { state: "/selected/id" } },
  children: [
    entry("Title", "/selected/title"),
    memo("Body", "/selected/body"),
    picker("/selected/state"),
    outcome([
      press("Save task", "board.save", {
        taskId: { state: "/selected/id" },
        title: { state: "/selected/title" },
        body: { state: "/selected/body" },
        state: { state: "/selected/state" },
      }, { variant: "solid" }),
      press("Delete task", "board.delete", { taskId: { state: "/selected/id" } }, { variant: "soft", color: "red" }),
    ], [["/selectedResult/id", "Saved"], ["/selectedResult/ok", "Deleted"]]),
  ],
}

/**
 * A failed read, and the way back to a record without leaving the console. The
 * press carries nothing: `board.load` reads its id from the address, so it is
 * the same read the screen's own entry made. A write that failed needs no press
 * of its own here — `Save task` and `Delete task` are below it, still holding the
 * values they sent.
 */
const retryRead: UiNodeSpec = row([
  { ...press("Try again", "board.load", undefined, { variant: "soft", size: "1" }),
    visible: { source: { state: "/selected/error" } } },
])

export const taskScreen: readonly UiNodeSpec[] = [
  heading("Task", { size: "4" }),
  refusal("/selected/error"),
  retryRead,
  nothingOpen,
  record,
]
