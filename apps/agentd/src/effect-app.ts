import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { createAgentdPlugin } from "./effect-plugin.ts"
import { effectUiView } from "./effect-ui.ts"
export const effectApp = defineApp({
  id: "agentd", title: "Agentd", description: "Machine and Agent configuration center", path: "/agentd",
  icon: "⬢", color: "gray",
  config: effectConfig, ui: effectUiView,
  /**
   * A machine that is not the main node reaches the main node's gateways through
   * the platform's relay; the main node answers the same call locally. One policy
   * covers both roles, so a machine's tunnel target never has to be rewritten
   * when its role changes.
   */
  egress: "main-first",
  createPlugin: (getConfig, context) => createAgentdPlugin(getConfig, { send: context.fetch }),
})
