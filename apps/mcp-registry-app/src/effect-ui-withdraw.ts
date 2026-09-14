/**
 * Withdrawing a server: the record being taken out, and the token that
 * authorizes it.
 *
 * A screen rather than a press on the row, because the registry holds one token
 * per server id and only that server's token authorizes its removal. A press on
 * the list would have to read a credential entered on a surface that cannot say
 * which server it is being entered for, and an address pasted cold would arrive
 * at a press that had nothing to act with. Here the server is named by the
 * parameter the row carried, the token is entered under that name, and the two
 * are read together.
 *
 * With no server named there is nothing to withdraw, so the form is not drawn
 * over an empty record and a token is not asked for on behalf of nothing. The
 * line in its place says what is absent and the route it arrives by, which is
 * the row's own Withdraw door.
 *
 * The parameter is the address's own, under the reserved root screen parameters
 * live at, so the press that carried the id and a link pasted cold fill the same
 * field (`screen.ts`).
 */
import { field, heading, press, row, text, NAV_ROOT, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer } from "./effect-ui-answer.ts"
import { refused, retry } from "./effect-ui-refusal.ts"
import { REGISTRY } from "./effect-ui-registry-source.ts"

const NAMED = `${NAV_ROOT}/serverId`
const TOKEN = "/withdraw/token"
const RESULT = "/withdraw/result"

const form: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "4" },
  visible: { source: { state: NAMED } },
  children: [
    text("This takes the server out at once and cannot be undone. It acts with that server's own token.", { size: "2", color: "gray" }),
    field("Server", row([{ component: "Code", bind: NAMED }])),
    { component: "Flex", props: { direction: "column", gap: "3" }, children: [
      field("Server token", { component: "TextField.Root", props: { type: "password" }, bind: TOKEN }),
      row([press("Withdraw", "registry.withdraw", undefined, { variant: "solid", size: "2" })]),
    ] },
    answer("Withdrawn", `${RESULT}/serverId`),
    refused("Withdraw was refused.", `${RESULT}/error`, retry("registry.withdraw")),
  ],
}

export const withdrawScreen: readonly UiNodeSpec[] = [
  heading("Withdraw a server", { size: "4" }),
  { component: "Text", props: { value: "No server is named. Open Withdraw from a row in the server list.", size: "2", color: "gray" },
    visible: { source: { state: NAMED }, not: true } },
  form,
]

export const withdrawAction: UiActionSpec = {
  name: "registry.withdraw",
  method: "DELETE",
  url: "/mcp-registry/withdraw",
  params: { serverId: { state: NAMED }, token: { state: TOKEN } },
  result: RESULT,
  refresh: [REGISTRY],
}
