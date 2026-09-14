import type { EffectUiView } from "@effect-agent/effect-ui"
import { serversScreen, navigation } from "./effect-ui-list.ts"
import { previewAction, previewScreen } from "./effect-ui-preview.ts"
import { registerAction, registerScreen } from "./effect-ui-register.ts"
import { registryRetryAction, REGISTRY } from "./effect-ui-registry-source.ts"
import { rotateAction, rotateScreen } from "./effect-ui-rotate.ts"
import { withdrawAction, withdrawScreen } from "./effect-ui-withdraw.ts"

export const effectUiView: EffectUiView = {
  viewId: "mcp-registry-console",
  title: "MCP Registry",
  state: {
    registry: { servers: [] },
    register: { declaration: "", token: "", result: undefined },
    withdraw: { token: "", result: undefined },
    rotate: { token: "", result: undefined },
    preview: { result: undefined },
  },
  sources: [{ id: REGISTRY, url: "/mcp-registry", state: "/registry", refreshMs: 10000 }],
  actions: [navigation, [registerAction, withdrawAction, rotateAction, previewAction, registryRetryAction]].flat(),
  nodes: serversScreen,
  screens: [
    { id: "register", title: "Register a server", nodes: registerScreen },
    { id: "withdraw", title: "Withdraw a server", nodes: withdrawScreen },
    { id: "rotate", title: "Rotate a server token", nodes: rotateScreen },
    { id: "preview", title: "Preview a resource", nodes: previewScreen },
  ],
}
