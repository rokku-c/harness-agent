/**
 * The registry console: the servers it holds on the first screen, and the three
 * moves an operator makes around them — register one, withdraw one, preview a
 * ui:// resource one declares.
 *
 * The list leads because it is what an operator comes back to read; the moves
 * are destinations, entered and come back from rather than scrolled to, past a
 * registry that grows with every server that announces itself (Journey 3,
 * `docs/flows.md`). Register and preview are the header's doors, and withdraw is
 * the row's own because the row already stands on the server it names.
 *
 * Each move carries the credential it needs on the screen that makes it. The
 * registry holds one token per server id, so a token belongs to the act that
 * names that server — a single box on the list would authorize a press for a
 * server it cannot name, and an address pasted cold would arrive at a press that
 * had nothing to act with.
 */

import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { previewNodes } from "./effect-ui-preview.ts"
import { registerNodes } from "./effect-ui-register.ts"
import { registryHeader } from "./effect-ui-header.ts"
import { serversSection } from "./effect-ui-servers.ts"
import { withdrawNodes } from "./effect-ui-withdraw.ts"

export const effectUiView: EffectUiView = {
  viewId: "mcp-registry-console",
  title: "MCP Registry",
  state: {
    registry: { servers: [] },
    register: { declaration: "", token: "", result: undefined },
    withdraw: { token: "", result: undefined },
    preview: { serverId: "", uri: "", result: undefined },
  },
  sources: [{ id: "registry", url: "/mcp-registry", state: "/registry", refreshMs: 10000 }],
  actions: [
    // every door names a destination and nothing else: what fills one is the
    // screen's own, and each press that writes is made on the screen it is about
    { name: "registry.openRegister", opens: "register" },
    { name: "registry.openWithdraw", opens: "withdraw" },
    { name: "registry.openPreview", opens: "preview" },
    { name: "registry.register", method: "POST", url: "/mcp-registry/register", result: "/register/result", refresh: ["registry"] },
    { name: "registry.withdraw", method: "DELETE", url: "/mcp-registry/withdraw", result: "/withdraw/result", refresh: ["registry"] },
    { name: "registry.preview", method: "GET", url: "/-/registry/preview", result: "/preview/result" },
  ],
  nodes: [
    registryHeader,
    // The list is as long as the registry is, and how long that is is not the
    // surface's business: it scrolls in its own box, under a header that holds
    // the doors and stays where it was.
    region([serversSection]),
  ],
  screens: [
    { id: "register", title: "Register a server", nodes: registerNodes },
    { id: "withdraw", title: "Withdraw a server", nodes: withdrawNodes },
    { id: "preview", title: "Preview a resource", nodes: previewNodes },
  ],
}
