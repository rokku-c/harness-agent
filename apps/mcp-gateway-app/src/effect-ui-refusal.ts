/**
 * A failure, written where the control that caused it stands.
 *
 * Both parts are one node rather than several a screen must remember to place
 * together, because §9 makes each of them a rule: a sentence saying what failed,
 * the server's own reason in mono (it is a value, not prose, and it is the
 * gateway's own words rather than a rewrite of them), and the press that repeats
 * *exactly* the request that failed. The callers name the action rather than
 * handing over a finished press, so a retry cannot come to name a call other
 * than the one it retries.
 *
 * A source's failure and an action's are two builders because they are two
 * records: the runtime keeps one verdict per declared source at a reserved root,
 * and one answer per action at the path that action declared. `readFailed` shows
 * the vocabulary's own failure notice under its sentence; `refused` guards on
 * the action's own error, which is also why its callout cannot paint as an empty
 * red box before the first press.
 *
 * The sentence is the caller's, because what failed is the caller's fact; the
 * gateway never supplies it, since `Something went wrong` is a sentence a reader
 * cannot act on and the design system refuses it by name.
 */
import { failureNotice, press, sourceStatusPath, text, type UiNodeSpec } from "@effect-agent/effect-ui"

/** The press that repeats a failed request: the same action, the values still where it read them. */
export const retry = (action: string, label = "Try again"): UiNodeSpec =>
  press(label, action, undefined, { size: "1", variant: "soft" })

/** One action's answer, or the absence of one. */
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

/**
 * One source that could not be read, as the three things §9.1 asks for. The
 * wrapper carries the guard, so the sentence and the press are shown on the same
 * condition the notice is and cannot disagree with it.
 */
export const readFailed = (sentence: string, id: string, action: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: { source: { state: `${sourceStatusPath(id)}/state` }, equals: "failed" },
  children: [text(sentence, { size: "2" }), failureNotice(id), retry(action)],
})
