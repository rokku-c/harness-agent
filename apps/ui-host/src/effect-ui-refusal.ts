/**
 * A failure, written where the control that caused it stands.
 *
 * The three parts are one node rather than three a screen must remember to place
 * together, because §9 makes each of them a rule: a sentence saying what failed,
 * the server's own reason in mono (it is a value, not prose), and the press that
 * repeats *exactly* the request that failed. A reason with no way out is the
 * defect §9 names as "no error without a retry".
 *
 * `highContrast` is the design system's own switch, for the reason §3.4 gives: a
 * soft callout draws its text in step 11 over a tinted ground, which is the
 * combination that fails AA in the light appearance, and step 12 is what clears
 * it. The guard is the bound path itself, so the callout cannot paint as an
 * empty red box before the first press.
 *
 * A retry that carries values carries the ones that failed, read from state the
 * failure did not take away. A press whose parameters are stated on its action
 * hands over none, and the runtime resolves them from that one declaration — so
 * the retry asks the same question the press asked rather than a second one
 * written out here.
 */
import { press, type UiActionParam, type UiNodeSpec } from "@effect-agent/effect-ui"

/** The press that repeats a failed request: the same action, the same values. */
export const retry = (action: string, params?: Readonly<Record<string, UiActionParam>>): UiNodeSpec =>
  press("Try again", action, params, { size: "1", variant: "soft" })

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
