/**
 * A failure, written where the control that caused it stands.
 *
 * The three parts are one node rather than three a screen must remember to place
 * together, because §9 makes each of them a rule: a sentence saying what failed,
 * the server's own reason in mono (it is a value, not prose), and the press that
 * repeats *exactly* the request that failed. The caller names the action rather
 * than handing over a press, so a retry cannot come to name a call other than
 * the one it retries.
 *
 * `highContrast` is the design system's own switch, for the reason §3.4 gives: a
 * soft callout draws its text in step 11 over a tinted ground, which is the
 * combination that fails AA in the light appearance, and step 12 is what clears
 * it. The guard is the bound path itself, so the callout cannot paint as an
 * empty red box before the first press (`readout.ts` is the same arrangement).
 */
import { press, type UiNodeSpec } from "@effect-agent/effect-ui"

/** The press that repeats a failed request: the same action, the same values. */
export const retry = (action: string): UiNodeSpec =>
  press("Try again", action, undefined, { size: "1", variant: "soft" })

export const refused = (sentence: string, bind: string, again: UiNodeSpec): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", highContrast: true, size: "1" },
  visible: { source: { state: bind } },
  children: [{
    component: "Flex",
    props: { direction: "column", gap: "2" },
    children: [{ component: "Callout.Text", props: { value: sentence } }, { component: "Code", bind }, again],
  }],
})
