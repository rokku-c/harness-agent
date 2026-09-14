/**
 * The MCP registry console, declared once.
 *
 * The registry is the catalogue the gateway decides from: M2 exposes a tool only
 * when its server is registered, healthy and declares it, so this surface is a
 * read first and an act second. The start screen is therefore the server list,
 * and the three moves around it are destinations rather than panels — each one
 * carries a credential, and the registry holds one token per server id, so a
 * token belongs to the act that names its server and to no other.
 *
 * Every move lands back on the list, which is what makes the list worth being
 * the first screen: registering, withdrawing and reading a resource each refresh
 * the one read behind it, so the outcome of a press is the row that changed
 * rather than only a line under the press.
 *
 * The operations themselves are declared once in `ops.ts` and served to the
 * console and to an agent from there, so what this file adds is where a value
 * comes from and which screen a press enters — never a second account of what a
 * registry operation is.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { serversScreen, navigation } from "./effect-ui-list.ts"
import { previewAction, previewScreen } from "./effect-ui-preview.ts"
import { registerAction, registerScreen } from "./effect-ui-register.ts"
import { registryRetryAction, REGISTRY } from "./effect-ui-registry-source.ts"
import { withdrawAction, withdrawScreen } from "./effect-ui-withdraw.ts"

export const effectUiView: EffectUiView = {
  viewId: "mcp-registry-console",
  title: "MCP Registry",
  state: {
    registry: { servers: [] },
    register: { declaration: "", token: "", result: undefined },
    withdraw: { token: "", result: undefined },
    preview: { result: undefined },
  },
  sources: [{ id: REGISTRY, url: "/mcp-registry", state: "/registry", refreshMs: 10000 }],
  actions: [navigation, [registerAction, withdrawAction, previewAction, registryRetryAction]].flat(),
  nodes: serversScreen,
  screens: [
    { id: "register", title: "Register a server", nodes: registerScreen },
    { id: "withdraw", title: "Withdraw a server", nodes: withdrawScreen },
    { id: "preview", title: "Preview a resource", nodes: previewScreen },
  ],
}
