/**
 * A failure, written where the thing that failed stands.
 *
 * §9 makes each of the three parts a rule and none of them optional: a sentence
 * saying what failed, the server's own reason in mono (it is a value, not prose),
 * and the press that repeats *exactly* the request that failed. They are one node
 * rather than three a screen must remember to place together, and the guard is
 * the bound path itself — so a callout cannot paint as an empty red box before
 * the first attempt, and there is no second `visible` argument to get wrong.
 *
 * `highContrast` is the design system's own switch, for the reason §3.4 gives: a
 * soft red callout draws step-11 text over a red tint, which is the combination
 * that fails AA in the light appearance, and step 12 is what clears it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { press, row } from "./effect-ui-nodes.ts"
import { sourceStatusPath } from "./effect-ui-nodes.ts"

/** The press that repeats a failed request: the same action, and nothing else. */
export const retry = (action: string): UiNodeSpec =>
  press("Try again", action, undefined, { size: "1", variant: "soft" })

export const refused = (sentence: string, bind: string, again: UiNodeSpec): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", highContrast: true, size: "1" },
  visible: { source: { state: bind } },
  children: [
    { component: "Flex", props: { direction: "column", gap: "2" }, children: [
      { component: "Callout.Text", props: { value: sentence } },
      { component: "Code", props: { size: "1", variant: "soft" }, bind },
      // a press put straight into a column stretches across it, and a button the
      // width of the callout reads as the callout's own, not as a way out of it
      row([again]),
    ] },
  ],
})

/**
 * A read that failed, above the rows it feeds, with the way back to it.
 *
 * A source is read on its own timer and a press cannot re-run one, so the retry
 * makes the read's own call and then refreshes the source: the call is what the
 * failure was about, and the refresh is the write that clears the failed verdict.
 *
 * The rows already on screen stay on screen — a failed fetch leaves the last good
 * answer where it is (`source-status.ts`) — so this sits above them rather than
 * in place of them, and it is why the retry is worth pressing at all.
 */
export const readFailure = (id: string, sentence: string, again: UiNodeSpec): UiNodeSpec =>
  refused(sentence, `${sourceStatusPath(id)}/error`, again)
