/**
 * The two lists behind the provider table: which rules rewrite a request on its
 * way out, and which paths the gateway answers on.
 *
 * Both are configuration and neither can be changed from here, so neither is on
 * the first screen: they are somewhere an operator goes rather than something
 * they work on.
 *
 * A rule is identified by the id its configuration gives it, which is the only
 * name it has, so it leads its row as a value rather than as prose.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip } from "@effect-agent/effect-ui"
import { mono, note, listRows } from "./effect-ui-nodes.ts"

const RULES = "/models/rules"

/**
 * One field a rule can match on, shown only when the rule names it.
 *
 * The fields are optional and a rule names as many as it needs, so the cell is
 * a stack of the ones that are there. The alternative — one column per field —
 * is four columns that are empty on almost every row, and a column of blanks is
 * a column of nothing. The word before the value is not decoration: the value
 * alone is a bare string, and nothing in it says whether it is an agent, a
 * model or a path.
 */
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

/** What the rule puts into the request, and where in it. */
const injected: UiNodeSpec = cellOf([{ component: "Text", props: { size: "2" }, item: "inject/content" }])

/**
 * The position is optional and the app's own default is a system prefix, so the
 * cell states the effective one either way: a rule that named none lands in the
 * same place as a rule that named `system-prefix`, and an operator reading this
 * column wants where the content goes, not what was typed.
 */
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

/**
 * The paths the gateway answers on. Each row in the list is one bare string
 * with no field around it, so the row's content is the item itself — the empty
 * item path is what says that.
 */
export const endpointsSection: readonly UiNodeSpec[] = [
  note("The paths this app answers on. The set is fixed by the app's own routes rather than by its configuration."),
  ...listRows(["Path"], [cellOf([chip("")])], "/models/endpoints",
    "No endpoint is registered. The paths this app serves are declared in its routes."),
]
