import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { createAgentdPlugin } from "./effect-plugin.ts"
export const effectApp: EffectAppDescriptor = {
  id: "agentd", title: "agentd", description: "Machine and Agent configuration center", path: "/agentd",
  routes: [{ path: "/agentd", match: "prefix" }], config: effectConfig, createPlugin: () => createAgentdPlugin(),
}
