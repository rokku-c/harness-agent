/**
 * The registry console: what is registered and how it is doing, and the three
 * operator moves around it — register a server, withdraw one from its row, and
 * preview a ui:// resource a server declares.
 *
 * Registering leads, because taking a server in is what a registry is for and
 * the list below it is the state that comes of it. The credential both writes
 * act with is stated once, above them: the registry holds one token per server
 * id, and the same value authorizes registering and withdrawing that server, so
 * two password boxes would be asking twice for one thing.
 */

import type { EffectUiView, UiNodeSpec } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { field, heading, text } from "./effect-ui-nodes.ts"
import { serversSection } from "./effect-ui-servers.ts"
import { registerSection } from "./effect-ui-register.ts"
import { previewSection } from "./effect-ui-preview.ts"

/** The page's one credential, above the two moves it authorizes. */
const credential: readonly UiNodeSpec[] = [
  field("Server token", { component: "TextField.Root", props: { type: "password" }, bind: "/token" }),
  text("The token the registry holds for a server id; it authorizes that server's registration and its withdrawal.",
    { size: "1", color: "gray" }),
]

const nodes: readonly UiNodeSpec[] = [
  heading("MCP Registry", { size: "6" }),
  text("MCP servers, transport, leases, health, and ui:// previews.", { size: "2", color: "gray" }),
  ...credential,
  // Three moves on one list of servers, and the list is as long as the registry
  // is. The token above them stays put: it is what every press below writes with.
  region([registerSection, serversSection, previewSection]),
]

export const effectUiView: EffectUiView = {
  viewId: "mcp-registry-console",
  title: "MCP Registry",
  state: {
    registry: { servers: [] },
    token: "",
    register: { declaration: "", result: undefined },
    withdraw: { result: undefined },
    preview: { serverId: "", uri: "", result: undefined },
  },
  sources: [{ id: "registry", url: "/mcp-registry", state: "/registry", refreshMs: 10000 }],
  actions: [
    { name: "registry.register", method: "POST", url: "/mcp-registry/register", result: "/register/result", refresh: ["registry"] },
    { name: "registry.withdraw", method: "DELETE", url: "/mcp-registry/withdraw", result: "/withdraw/result", refresh: ["registry"] },
    { name: "registry.preview", method: "GET", url: "/-/registry/preview", result: "/preview/result" },
  ],
  nodes,
}
