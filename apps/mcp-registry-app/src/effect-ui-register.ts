/**
 * Registering a server: the declaration an operator pastes, and the server the
 * announce answered with.
 *
 * The answer is the record the registry took, so the readout names the server
 * that was acknowledged rather than reporting that some press returned. The
 * failure readout is guarded, because an error that is not there yet is not a
 * state to render. The declaration is not cleared on success: an announce is an
 * upsert, so pressing twice asserts the same server rather than making a second
 * one. The token that authorizes the press is the page's credential.
 */

import { row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { failure, field, section, text } from "./effect-ui-nodes.ts"

const declaration = '{"serverId":"example","name":"example","version":"1","era":"modern","transport":{"kind":"streamable-http","endpoint":"https://example.test/mcp"}}'

/** The server the registry now holds, named by the id the announce answered with. */
const registered: UiNodeSpec = { component: "Flex", props: { gap: "2", align: "center", wrap: "wrap" },
  visible: { source: { state: "/register/result/serverId" } },
  children: [
    text("Registered", { size: "2", color: "green" }),
    { component: "Code", props: { variant: "soft", size: "1" }, bind: "/register/result/serverId" },
  ] }

export const registerSection: UiNodeSpec = section("Register a server", [
  text("The declaration a server announces with; an id the registry already holds is replaced.", { size: "2", color: "gray" }),
  field("Server declaration", { component: "TextArea", props: { placeholder: declaration }, bind: "/register/declaration" }),
  row([{ component: "Button", props: { value: "Register" }, onPress: "registry.register",
    params: { token: { state: "/token" }, declaration: { state: "/register/declaration" } } }]),
  registered,
  failure("/register/result/error"),
])
