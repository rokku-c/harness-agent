/**
 * The server list: what is registered, and the state each server is in.
 *
 * A row declares ui:// resources or it declares none, so the resources are read
 * inside the row's identity instead of standing in a column that would be empty
 * on nearly every line.
 *
 * The list is a read surface and nothing else, which is why the one act an
 * operator makes from a row is a door rather than a press: taking a server out
 * is irreversible and only the server's own token authorizes it, so the act has
 * a screen of its own where that token is entered and the record being removed
 * is named (`effect-ui-withdraw.ts`). A dialog on this surface would have had to
 * ask for the token without ever saying which server it was for.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, list, row, section, sourceStates, table, text } from "@effect-agent/effect-ui"

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
 * The door out of a row, carrying the id it stands for: an operator who wants a
 * server gone should not have to retype the id it is listed under. It is a soft
 * red press because it leads to the destruction of this row, not because it
 * performs it — the pressing is done on the screen it opens.
 */
const withdraw: UiNodeSpec = cellOf({ component: "Button",
  props: { value: "Withdraw", size: "1", variant: "soft", color: "red" },
  onPress: "registry.openWithdraw",
  params: { serverId: { item: "serverId" } } })

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

/** The list, and the states of the one read behind it. */
export const serversSection: UiNodeSpec = section("Servers", [
  text("One row per registered server; a row's Withdraw opens the act that removes it.", { size: "2", color: "gray" }),
  ...sourceStates("registry", "No MCP servers are registered yet."),
  table(["Server", "Version", "Era", "Status", "Withdraw"], cells,
    { source: { state: "/registry/servers" }, key: "serverId" }),
])

