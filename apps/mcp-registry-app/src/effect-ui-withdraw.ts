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
      text("Lost the token? Rotate it: the server keeps its record and is authorized by a new one.", { size: "2", color: "gray" }),
      row([press("Rotate token", "registry.openRotate", { serverId: { state: NAMED } }, { size: "1", variant: "soft" })]),
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
