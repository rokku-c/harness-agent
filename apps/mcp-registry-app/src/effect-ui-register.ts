import { field, heading, press, row, text, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer } from "./effect-ui-answer.ts"
import { refused, retry } from "./effect-ui-refusal.ts"
import { REGISTRY } from "./effect-ui-registry-source.ts"

const DECLARATION = "/register/declaration"
const TOKEN = "/register/token"
const RESULT = "/register/result"

const declared =
  '{"serverId":"example","name":"example","version":"1","era":"modern","transport":{"kind":"streamable-http","endpoint":"https://example.test/mcp"}}'

const form: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Server declaration", { component: "TextArea", props: { placeholder: declared }, bind: DECLARATION }),
    field("Server token", { component: "TextField.Root", props: { type: "password" }, bind: TOKEN }),
    row([press("Register", "registry.register", undefined, { variant: "solid", size: "2" })]),
  ],
}

export const registerScreen: readonly UiNodeSpec[] = [
  heading("Register a server", { size: "4" }),
  text("A declaration is a server announcing itself. An id the registry already holds is replaced by what is announced here.", { size: "2", color: "gray" }),
  text("The registry never shows a token back. Keep this one: the server's own moves are authorized by it.", { size: "2", color: "gray" }),
  form,
  answer("Registered", `${RESULT}/serverId`),
  refused("Register was refused.", `${RESULT}/error`, retry("registry.register")),
]

export const registerAction: UiActionSpec = {
  name: "registry.register",
  method: "POST",
  url: "/mcp-registry/register",
  params: { declaration: { state: DECLARATION }, token: { state: TOKEN } },
  result: RESULT,
  clear: [TOKEN],
  refresh: [REGISTRY],
}
