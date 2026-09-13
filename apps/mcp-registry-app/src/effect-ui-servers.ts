/**
 * The server list: what is registered, the state each server is in, and the one
 * action an operator takes from a row.
 *
 * A row declares ui:// resources or it declares none, so the resources are read
 * inside the row's identity instead of standing in a column that would be empty
 * on nearly every line. The withdraw takes effect at once and cannot be undone,
 * so it is offered only while the credential above is filled: a press that could
 * not have been authorized is a press the operator could not have meant. The
 * readout sits under the rows, where the press was, and names the server the
 * answer named rather than reporting that some press returned.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row, sourceStates } from "@effect-agent/effect-ui"
import { cell, cellOf, failure, list, section, table, text } from "./effect-ui-nodes.ts"

/**
 * The resources a row declares, under the id it declares them from. Guarded on
 * the first entry rather than on the array, because an empty array is truthy
 * and would leave the label over nothing.
 */
const declaredResources: UiNodeSpec = { component: "Flex", props: { direction: "column", gap: "1" },
  visible: { source: { item: "apps/0" } },
  children: [
    text("ui:// resources", { size: "1", color: "gray" }),
    // Each uri is a chip, so the list column holds rows: a column stretches what
    // it holds, and a stretched uri would paint as a bar.
    list({ source: { item: "apps" } }, row([{ component: "Code", props: { variant: "ghost", size: "1" }, item: "" }])),
  ] }

/**
 * A row's identity: the name an operator reads, over the id and the resources it
 * declares. The stack is aligned to its start, because a column stretches what
 * it holds and a stretched id would paint as a bar under the name rather than as
 * the chip it is.
 */
const identity: UiNodeSpec = cellOf({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
  { component: "Text", item: "name" },
  { component: "Code", props: { variant: "soft", size: "1" }, item: "serverId" },
  declaredResources,
] })

/**
 * The primary action for a row, carrying the id it stands for: an operator who
 * wants a server gone should not have to retype the id it is listed under.
 */
const withdraw: UiNodeSpec = cellOf({ component: "Button",
  props: { value: "Withdraw", size: "1", variant: "soft", color: "red" },
  visible: { source: { state: "/token" } },
  onPress: "registry.withdraw",
  params: { serverId: { item: "serverId" }, token: { state: "/token" } } })

const cells: readonly UiNodeSpec[] = [
  identity,
  cell("version"),
  // One row carries one badge: the status it is in, named by its value. An era
  // is a fixed tag rather than a state, so it is text, and colour is left for
  // the signals a row cannot name as an enumeration.
  cell("era"),
  cellOf({ component: "Badge", props: { variant: "soft" }, item: "status" }),
  withdraw,
]

/** The server the registry no longer holds, named by the id the withdraw answered with. */
const withdrawn: UiNodeSpec = { component: "Flex", props: { gap: "2", align: "center", wrap: "wrap" },
  visible: { source: { state: "/withdraw/result/serverId" } },
  children: [
    text("Withdrawn", { size: "2", color: "green" }),
    { component: "Code", props: { variant: "soft", size: "1" }, bind: "/withdraw/result/serverId" },
  ] }

/** The list, its four states, and the press that writes from a row. */
export const serversSection: UiNodeSpec = section("Servers", [
  text("One row per registered server; Withdraw removes one, acting with the token above.", { size: "2", color: "gray" }),
  ...sourceStates("registry", "No MCP servers are registered yet."),
  table(["Server", "Version", "Era", "Status", "Withdraw"], cells,
    { source: { state: "/registry/servers" }, key: "serverId" }),
  withdrawn,
  failure("/withdraw/result/error"),
])
