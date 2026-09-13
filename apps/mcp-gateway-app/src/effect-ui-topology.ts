/**
 * What the gateway is made of: the servers the registry holds, the sets that
 * group them, and the agents bound to those sets. All three lists are read from
 * one source, so whether that read is still running or failed is stated once,
 * above the group: per list it would be nine skeletons for one slow read and
 * three identical callouts for one failed one. Each list still says its own
 * emptiness, which is a fact about the list rather than about the read.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows } from "@effect-agent/effect-ui"
import { cell, cellOf, chip, chipList, line, list, listCard, stateBadge } from "./effect-ui-nodes.ts"

/**
 * The tool names a set allows or refuses, or the word that says the set
 * declares no such list. Both are optional in the config, so a set that
 * restricts nothing — the common case — would otherwise leave a blank cell,
 * which reads like a table whose data never arrived.
 */
const tools = (field: string, none: string): UiNodeSpec =>
  cellOf({ component: "Flex", props: { direction: "column", gap: "1" }, children: [
    list({ source: { item: field } }, line("", { size: "1", color: "gray" })),
    { component: "Text", props: { value: none, size: "1", color: "gray" },
      visible: { source: { item: field }, not: true } },
  ] })

/**
 * A server leads with its name: an operator reads a topology, not a key. Its id
 * is the repeat key, since the membership list in the Sets table is the one
 * place an id is the content — a second rendering of it here would be a rival
 * answer to what a set contains.
 */
const servers: UiNodeSpec = listCard({
  title: "Servers", id: "topology", empty: "No servers registered yet.",
  headings: ["Server", "Era", "Status"],
  cells: [cell("name"), cellOf(stateBadge("era")), cellOf(stateBadge("status"))],
  repeat: { source: { state: "/gateway/servers" }, key: "serverId" },
})

/** A set's own identity is its name; the ids it holds are what it contains. */
const sets: UiNodeSpec = listCard({
  title: "Sets", id: "topology", empty: "No sets configured yet.",
  headings: ["Set", "Servers", "Allow tools", "Deny tools"],
  cells: [cell("name"), cellOf(chipList({ source: { item: "servers" } }, "")),
    tools("allowTools", "any"), tools("denyTools", "none")],
  repeat: { source: { state: "/gateway/sets" }, key: "setId" },
})

/** A binding is about one agent, and an agent is an address with no name. */
const bindings: UiNodeSpec = listCard({
  title: "Bindings", id: "topology", empty: "No agents bound to a set yet.",
  headings: ["Agent", "Sets"],
  cells: [cellOf(chip("agentId")), cellOf(chipList({ source: { item: "setIds" } }, ""))],
  repeat: { source: { state: "/gateway/bindings" }, key: "agentId" },
})

/** The read's own state, stated once above the three lists it feeds, then the lists. */
export const topologySections: readonly UiNodeSpec[] = [
  loadingRows("topology", 3), failureNotice("topology"), servers, sets, bindings,
]
