import { chip, heading, list, press, region, row, section, text, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"
import { ACCESS_RESULT, DECISION, FIXING, NAV_AGENT, NAV_TOOL } from "./effect-ui-paths.ts"
import { boundSets } from "./effect-ui-bound-sets.ts"

const shown = (path: string, value: boolean, word: string, tone: "ok" | "denied"): UiNodeSpec =>
  ({ ...toneBadge(tone, word), visible: { source: { state: path }, equals: value } })

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

const why: UiNodeSpec = {
  ...section("Why it was refused", [
    list({ source: { state: `${DECISION}/reasons` } }, chip("")),
    text("A call that reaches no set is refused for the first fact that is true of it, most specific first.", { size: "1", color: "gray" }),
  ]),
  visible: { source: { state: `${DECISION}/allowed` }, equals: false },
}

const recovery: UiNodeSpec = {
  ...section("What would change it", [
    text("A grant is a binding from a principal to a set, and the set's server list, allow list and deny list are what decide this call.", { size: "2" }),
    { ...press("", "gateway.openGrants", undefined, { variant: "solid", size: "2" }),
      bind: `${FIXING}/label`, visible: { source: { state: FIXING } } },
    { ...row([press("Read the topology", "gateway.openTopology", undefined, { variant: "soft", size: "2" })]),
      visible: { source: { state: FIXING }, not: true } },
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
