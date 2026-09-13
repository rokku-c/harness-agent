/**
 * The access preview — the one question this console exists to answer: may this
 * agent reach this tool, and if not, why. The answer is read in the card the
 * operator pressed in, so a preview that failed says so here rather than
 * nowhere: the topology below this card is only ever the configuration that
 * went in, never the verdict that came out.
 */

import { failureCallout, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, chipList, field, line, list, section, table, text } from "./effect-ui-nodes.ts"

/** True-or-false is the one condition that earns colour: a refusal is a signal. */
const outcome = (value: string, color: string, allowed: boolean): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color, value }, visible: { source: { state: "/access/result/access/allowed" }, equals: allowed } })

/**
 * The preview's own failure. The action runtime writes `{ ok: false, error }`
 * at `/access/result`, beside the paths a successful preview occupies — so a
 * refused or unreachable preview is a record no outcome path can report.
 */
const failure = failureCallout("/access/result/error")

/**
 * Reasons are the shape of a refusal; the gateway clears them on an allowance.
 * A refusal it cannot explain — a binding naming a set the config no longer
 * declares — serves none, and "Denied because" over an empty list is a heading
 * claiming something it does not have. The heading is said only when there is
 * something under it; the badge above still states the verdict either way.
 */
const reasons: UiNodeSpec = { component: "Flex", props: { direction: "column", gap: "1" },
  visible: { source: { state: "/access/result/access/allowed" }, equals: false },
  children: [{
    component: "Flex", props: { direction: "column", gap: "1" },
    visible: { source: { state: "/access/result/access/reasons/0" } },
    children: [
      text("Denied because", { size: "2", color: "gray" }),
      list({ source: { state: "/access/result/access/reasons" } }, line("", { size: "2", color: "gray" })),
    ],
  }] }

/**
 * The sets the preview resolved, when it resolved any. An agent bound to
 * nothing reaches nothing, and the reasons above are what say so — a table
 * showing a header over no rows would read as a table that failed to load.
 */
const sets: UiNodeSpec = { ...table(["Set", "Servers"],
    [cell("name"), cellOf(chipList({ source: { item: "servers" } }, "serverId"))],
    { source: { state: "/access/result/access/sets" }, key: "setId" }),
  visible: { source: { state: "/access/result/access/sets/0" } } }

/**
 * Everything a successful preview writes, behind one guard: before the first
 * press none of these paths exist, and the block would read as "this agent
 * reaches nothing" rather than "you have not asked yet".
 */
const answer: UiNodeSpec = { component: "Flex", props: { direction: "column", gap: "3" },
  visible: { source: { state: "/access/result/ok" }, equals: true },
  children: [
    row([outcome("Allowed", "green", true), outcome("Denied", "red", false)]),
    sets,
    reasons,
  ] }

export const accessSection: UiNodeSpec = section("Effective access", [
  field("Agent id", { component: "TextField.Root", bind: "/access/agent" }),
  field("Tool (optional)", { component: "TextField.Root", bind: "/access/tool" }),
  row([{ component: "Button", props: { value: "Preview" }, onPress: "gateway.access",
    params: { agent: { state: "/access/agent" }, tool: { state: "/access/tool" } } }]),
  failure,
  answer,
])
