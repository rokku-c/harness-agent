/**
 * Withdrawing a registered server: the record being taken out, the token that
 * authorizes it, and the press.
 *
 * It is a screen rather than a press on the row because the registry holds one
 * token per server id and only that server's own token authorizes its removal.
 * A press on the list would have to read a credential entered somewhere else —
 * on a surface that cannot say which server it is being entered for — and an
 * address pasted into the bar would arrive at a press that could not have been
 * authorized. Here the server is named by the address the row carried, the token
 * is entered under that name, and the two are read together.
 *
 * The readout sits under the press, and names the server the answer named rather
 * than reporting that some press returned: an operator removing a server should
 * read which one is gone.
 */

import { failureCallout, field, row, section, text, type UiNodeSpec } from "@effect-agent/effect-ui"
import { NAV_ROOT } from "@effect-agent/effect-ui"

/** The record this act is about: the id the row carried into the address. */
const named: UiNodeSpec = field("Server", row([{ component: "Code", props: { variant: "soft", size: "1" }, bind: `${NAV_ROOT}/serverId` }]))

/** The server the registry no longer holds, named by the id the withdraw answered with. */
const withdrawn: UiNodeSpec = { component: "Flex", props: { gap: "2", align: "center", wrap: "wrap" },
  visible: { source: { state: "/withdraw/result/serverId" } },
  children: [
    text("Withdrawn", { size: "2", color: "green" }),
    { component: "Code", props: { variant: "soft", size: "1" }, bind: "/withdraw/result/serverId" },
  ] }

export const withdrawNodes: readonly UiNodeSpec[] = [
  { component: "Text", props: { value: "No server is named. Withdraw one from the list.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/serverId` }, not: true } },
  section("Withdraw a server", [
    text("This takes the server out at once and cannot be undone. It acts with that server's own token.", { size: "2", color: "gray" }),
    named,
    field("Server token", { component: "TextField.Root", props: { type: "password" }, bind: "/withdraw/token" }),
    row([{ component: "Button", props: { value: "Withdraw", color: "red" }, onPress: "registry.withdraw",
      params: { serverId: { state: `${NAV_ROOT}/serverId` }, token: { state: "/withdraw/token" } } }]),
    withdrawn,
    failureCallout("/withdraw/result/error"),
  ]),
]
