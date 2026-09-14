/**
 * The New task screen: the draft, and the one press that sends it.
 *
 * The draft lives under `/create` rather than beside the record a row opened,
 * because a write's failure lands on the path it wrote: two forms sharing one
 * path would show each other's refusals, and a refusal shown against the wrong
 * form is worse than none.
 *
 * The press carries no `opens`, and it cannot. An action's parameters are
 * resolved before its call, so a press cannot name the id its own call is about
 * to produce — there is no value yet to carry. What the screen can say instead is
 * that the task exists: `Created` beside the press, read off the id the answer
 * brought back, and the `table` refresh already underway is what puts its row on
 * the board.
 *
 * A refused create keeps the draft. Only a write that succeeded empties what it
 * consumed, so the two fields it sent are cleared on the way out and a title the
 * server rejected is still there to correct. `Create task` is also the retry —
 * it is still on screen holding the values it sent, and a second control saying
 * the same thing would be a copy of it.
 */

import { heading, press, type UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, memo, picker, refusal } from "./effect-ui-fields.ts"
import { outcome } from "./effect-ui-outcome.ts"

export const createScreen: readonly UiNodeSpec[] = [
  heading("New task", { size: "4" }),
  refusal("/createResult/error"),
  { component: "Flex", props: { direction: "column", gap: "3" }, children: [
    entry("Title", "/create/title"),
    memo("Body", "/create/body"),
    picker("/create/state"),
    outcome([
      press("Create task", "board.create", {
        title: { state: "/create/title" },
        body: { state: "/create/body" },
        state: { state: "/create/state" },
      }, { variant: "solid" }),
    ], [["/createResult/id", "Created"]]),
  ] },
]
