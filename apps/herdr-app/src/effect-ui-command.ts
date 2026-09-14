/**
 * A press, and the answer it leaves directly under itself.
 *
 * §9.4 writes an action's answer at the control that caused it, so the control
 * and its answer are one node here: a press a screen places on its own is a press
 * whose answer some other part of the screen has to remember to show, and the
 * first screen that forgets reports a refusal nowhere.
 *
 * A press carries no values of its own. Every parameter these presses send is
 * declared on the action, so a press is a button and its retry is the same button
 * — where a press owned a value, its retry would have to own the same one, and
 * the two could come apart. (The one press that does supply values is a row's
 * Open, which sends the id of the row it stands on; that is a plain button in
 * `effect-ui-cells.ts`, not a command.)
 *
 * `done` is the one word a success leaves behind, and it is optional because some
 * presses answer with content rather than with a word — `Read again` writes the
 * output it read, and a badge reading "read" beside it would be a second telling
 * of what the operator is already looking at.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import type { HerdrAction } from "./effect-ui-actions.ts"
import { refused } from "./effect-ui-failures.ts"
import { outcomeError, outcomeOk, row } from "./effect-ui-nodes.ts"

export interface Command {
  /** What the press does, in the operator's words. */
  readonly label: string
  readonly action: HerdrAction
  readonly variant?: "solid" | "soft"
  /** What the server refused, as §9.4 asks for it: `<Action label> was refused.` */
  readonly sentence: string
  /** The word a successful press leaves behind; absent when its answer is content. */
  readonly done?: string
}

export const command = ({ label, action, variant = "soft", sentence, done }: Command): UiNodeSpec => {
  const button = (text: string, size: "1" | "2", look: "solid" | "soft"): UiNodeSpec =>
    ({ component: "Button", props: { value: text, size, variant: look }, onPress: action })
  return {
    component: "Flex", props: { direction: "column", gap: "1", align: "start" },
    children: [
      button(label, "2", variant),
      // a badge put straight into a column stretches to the column's width, which
      // paints a one-word answer as a banner across the block
      ...(done === undefined ? [] : [row([
        { component: "Badge", props: { variant: "surface", color: "jade", highContrast: true, value: done },
          visible: { source: { state: outcomeOk(action) }, equals: true } },
      ])]),
      refused(sentence, outcomeError(action), button("Try again", "1", "soft")),
    ],
  }
}
