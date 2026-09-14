import { field, heading, press, row, text, NAV_ROOT, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer } from "./effect-ui-answer.ts"
import { refused, retry } from "./effect-ui-refusal.ts"

const NAMED = `${NAV_ROOT}/serverId`
const TOKEN = "/rotate/token"
const RESULT = "/rotate/result"

const form: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "4" },
  visible: { source: { state: NAMED } },
  children: [
    text("This replaces that server's token at once. Tell the server the new one: the token it presents now stops being accepted.", { size: "2", color: "gray" }),
    text("The replacement lasts until this app restarts or is reloaded. Keep it by writing it into the registry's own configuration.", { size: "2", color: "gray" }),
    field("Server", row([{ component: "Code", bind: NAMED }])),
    { component: "Flex", props: { direction: "column", gap: "3" }, children: [
      field("New server token", { component: "TextField.Root", props: { type: "password" }, bind: TOKEN }),
      row([press("Rotate token", "registry.rotate", undefined, { variant: "solid", size: "2" })]),
    ] },
    answer("Rotated", `${RESULT}/serverId`),
    refused("Rotate was refused.", `${RESULT}/error`, retry("registry.rotate")),
  ],
}

export const rotateScreen: readonly UiNodeSpec[] = [
  heading("Rotate a server token", { size: "4" }),
  { component: "Text", props: { value: "No server is named. Open Rotate token from the withdraw screen, where a lost token is met.", size: "2", color: "gray" },
    visible: { source: { state: NAMED }, not: true } },
  form,
]

export const rotateAction: UiActionSpec = {
  name: "registry.rotate",
  method: "POST",
  url: "/mcp-registry/rotate",
  params: { serverId: { state: NAMED }, newToken: { state: TOKEN } },
  result: RESULT,
  clear: [TOKEN],
}
