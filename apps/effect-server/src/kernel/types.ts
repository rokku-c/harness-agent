import type { EgressRouter } from "@effect-agent/effect-network"
import type { EffectPluginHost, LoadedPlane } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
import type { McpSetSlot } from "@effect-agent/mcp-gateway"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { AppCatalog } from "@effect-agent/effect-apps"
import type { KernelRevision } from "@effect-agent/effect-bundle"
import type { ConfigRuntime } from "../config-runtime/types.ts"

export interface KernelContext {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  readonly network: EgressRouter
  readonly mcpRegistry: McpRegistry
  readonly mcpSets: McpSetSlot
  readonly uiViews: Map<string, EffectUiView>
  readonly catalog: AppCatalog
  readonly enabled: ReadonlySet<string>
  readonly yamlOf: (appId: string) => unknown
  readonly namespace?: string
  readonly observationFile?: string
  readonly dev?: boolean
  readonly revision?: KernelRevision
}

export interface KernelInstance {
  readonly id: string
  readonly planes: ReadonlyMap<string, LoadedPlane>
  start(planeId: string): Promise<void>
  stop(planeId: string): Promise<void>
  health(): Promise<void>
  dispose(): Promise<void>
}

export type KernelFactory = (context: KernelContext) => Promise<KernelInstance> | KernelInstance

export interface KernelArtifact {
  readonly entry: string
}
