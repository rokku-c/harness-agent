/**
 * Registering a server: the declaration it announces itself with, and the token
 * that authorizes every later move it makes.
 *
 * The sentence about the token is the one place the console can say what a token
 * is, and it is said here because this is where one is chosen: the registry
 * never shows it back, and the server's own heartbeat and withdrawal are
 * authorized by it, so a token nobody kept is a server nobody can withdraw.
 *
 * The declaration is not cleared on success. An announce is an upsert — the same
 * declaration asserts the same server — so pressing twice is a second assertion
 * of one record rather than a second record, and the draft is worth keeping. The
 * token is cleared, because the press consumed it and a form that keeps what it
 * just submitted invites the same press twice (`data-spec.ts`).
 *
 * Where each parameter comes from is stated once, on the action: the press and
 * the retry under it then read from one place, and the retry repeats the request
 * that failed with the values still in the form rather than with none.
 */
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
