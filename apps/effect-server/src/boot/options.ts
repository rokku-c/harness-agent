import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
import type { EgressRouter } from "@effect-agent/effect-network"
import type { makeManagedListeners } from "../network/listeners.ts"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { McpServer } from "@effect-agent/mcp-registry"
import type { ConfigRuntime } from "../config-runtime/types.ts"

export interface EffectServerOptions {
  readonly planes?: readonly string[]
  readonly control?: boolean
  readonly mcpServers?: readonly McpServer[]
  readonly configFile?: string
  readonly network?: unknown
}
export interface EffectServer {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly mcpRegistry: McpRegistry
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  readonly initializeConfig: (appId: string) => void
  readonly uiViews: Map<string, EffectUiView>
  readonly uiHtml: Map<string, string>
  readonly network: EgressRouter
  readonly listen: ReturnType<typeof makeManagedListeners>["listen"]
  readonly listeners: ReturnType<typeof makeManagedListeners>["list"]
  readonly stop: () => Promise<void>
}
export const csv = (raw: string | undefined): readonly string[] =>
  (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)
