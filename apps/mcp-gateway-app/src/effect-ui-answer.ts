/**
 * The answer: whether one principal reaches one tool, and why not.
 *
 * It is a screen of its own rather than a section under the question, and the
 * reason is the whole of M4's third point: the address of a screen carries its
 * parameters, so `#app/mcp-gateway/access?agent=app:writer&tool=files.read`
 * renders this exact answer on a colleague's machine. A preview that lived in
 * transient state could only ever be screenshotted, and a screenshot is not a
 * case anyone can re-run.
 *
 * The answer is read on arrival (`onEnter`) rather than by the press that got
 * here, which is what makes a pasted link and a press one path: the parameters
 * are in `/_nav` before the screen's action runs, so the action has no way to
 * tell which of the two put them there.
 *
 * The refusal is placed above the verdict and not in place of it. A decision
 * that could not be read is not a denial — the gateway never said no, it said
 * nothing — and a screen that painted `Denied` over a failed read would be
 * inventing the one answer an operator most needs to trust.
 */
import { chip, heading, list, press, region, row, section, text, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"
import { toneBadge } from "./effect-ui-tone.ts"
import { ACCESS_RESULT, DECISION, NAV_AGENT, NAV_TOOL } from "./effect-ui-paths.ts"
import { boundSets } from "./effect-ui-bound-sets.ts"

const shown = (path: string, value: boolean, word: string, tone: "ok" | "denied"): UiNodeSpec =>
  ({ ...toneBadge(tone, word), visible: { source: { state: path }, equals: value } })

/** What was asked, restated: the address carried it, and a reader must not have to decode the URL. */
const asked: UiNodeSpec = row([
  text("Principal", { size: "1", color: "gray" }),
  { component: "Code", bind: NAV_AGENT, visible: { source: { state: NAV_AGENT } } },
  text("Tool", { size: "1", color: "gray" }),
  { component: "Code", bind: NAV_TOOL, visible: { source: { state: NAV_TOOL } } },
  { ...text("any tool", { size: "2", color: "gray" }), visible: { source: { state: NAV_TOOL }, not: true } },
])

const verdict: UiNodeSpec = row([
  shown(`${DECISION}/allowed`, true, "Allowed", "ok"),
  shown(`${DECISION}/allowed`, false, "Denied", "denied"),
])

/**
 * The gateway's own words, in mono, because a reason is a value and not prose.
 * Nothing here rewrites them into a sentence of the console's own: the engine
 * named the set that refused and the list it refused by, and a paraphrase is
 * where a preview starts describing a decision other than the one it made.
 */
const why: UiNodeSpec = {
  ...section("Why it was refused", [
    list({ source: { state: `${DECISION}/reasons` } }, chip("")),
    text("A call that reaches no set is refused for the first fact that is true of it, most specific first.", { size: "1", color: "gray" }),
  ]),
  visible: { source: { state: `${DECISION}/allowed` }, equals: false },
}

/**
 * J7: a denial that cannot say how to fix itself is a wall.
 *
 * The edit is not here, and saying so is the point rather than a gap. A set and
 * a binding are declared in the center that issues the identity they are keyed
 * by, and this app reads them from there so that one fact has one author
 * (`effect-config.ts`). So the recovery this console can honestly offer is the
 * screen that names the deciding set and its lists, plus the sentence saying
 * where the change is made — the alternative, a `Add this tool to <set>` press
 * opening a form that does not exist here, is a wall with a button on it.
 */
const recovery: UiNodeSpec = {
  ...section("What would change it", [
    text("A grant is a binding from a principal to a set, and the set's server list, allow list and deny list are what decide this call.", { size: "2" }),
    text("Grants are declared in the agentd center. This console reads them and cannot write them.", { size: "2", color: "gray" }),
    row([press("Read the topology", "gateway.openTopology", undefined, { variant: "soft", size: "2" })]),
  ]),
  visible: { source: { state: `${DECISION}/allowed` }, equals: false },
}

export const answerScreen: readonly UiNodeSpec[] = [
  heading("Access decision", { size: "4" }),
  text("Answered by the gateway's own engine, so a preview cannot disagree with the call it predicts.", { size: "2", color: "gray" }),
  asked,
  refused("The decision could not be read.", `${ACCESS_RESULT}/error`, retry("gateway.previewAccess")),
  verdict,
  region([why, recovery, boundSets]),
]
