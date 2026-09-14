import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip } from "@effect-agent/effect-ui"
import { mono, note, listRows } from "./effect-ui-nodes.ts"

const RULES = "/models/rules"

const matchLine = (name: string, field: string): UiNodeSpec => ({
  component: "Flex", props: { gap: "1", align: "baseline" },
  visible: { source: { item: field } },
  children: [note(name), mono(field)],
})

const rule: UiNodeSpec = cellOf([chip("ruleId")])

const matches: UiNodeSpec = cellOf([{
  component: "Flex", props: { direction: "column", gap: "1", align: "start" },
  children: [
    matchLine("agent", "match/agent"),
    matchLine("session", "match/session"),
    matchLine("model", "match/model"),
    matchLine("path", "match/path"),
  ],
}])

const injected: UiNodeSpec = cellOf([{ component: "Text", props: { size: "2" }, item: "inject/content" }])

const position: UiNodeSpec = cellOf([
  { ...mono("inject/position"), visible: { source: { item: "inject/position" } } },
  { component: "Code", props: { variant: "ghost", size: "2", color: "gray", value: "system-prefix" },
    visible: { source: { item: "inject/position" }, not: true } },
])

export const rulesSection: readonly UiNodeSpec[] = [
  note("Each rule adds its content to the requests it matches. A rule that names no match applies to every request."),
  ...listRows(["Rule", "Matches", "Injects", "Position"], [rule, matches, injected, position], RULES,
    "No routing rule is configured. Rules are declared in this app's configuration.", "ruleId"),
]

export const endpointsSection: readonly UiNodeSpec[] = [
  note("The paths this app answers on. The set is fixed by the app's own routes rather than by its configuration."),
  ...listRows(["Path"], [cellOf([chip("")])], "/models/endpoints",
    "No endpoint is registered. The paths this app serves are declared in its routes."),
]
