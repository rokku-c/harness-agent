import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
import type { McpSetSlot } from "@effect-agent/mcp-gateway"
import type { EgressRouter } from "@effect-agent/effect-network"
import type { makeManagedListeners } from "../network/listeners.ts"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { BootResult, KernelDeclaration, KernelRepo, KernelRevision, StageResult } from "@effect-agent/effect-bundle"
import type { ConfigRuntime } from "../config-runtime/types.ts"
import type { KernelInstance } from "../kernel/index.ts"
import type { BundleApp } from "./bundle-reload.ts"
import type { ReloadOutcome } from "./reload-types.ts"

export interface EffectServerOptions {
  readonly planes?: readonly string[]
  readonly control?: boolean
  readonly dev?: boolean
  readonly configFile?: string
  readonly network?: unknown
  readonly kernel?: KernelDeclaration
  readonly kernelStateFile?: string
  readonly kernelRepo?: KernelRepo
  readonly bundles?: readonly BundleApp[]
  readonly bundleRoot?: string
}
export interface EffectServer {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly mcpRegistry: McpRegistry
  readonly mcpSets: McpSetSlot
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  readonly initializeConfig: (appId: string) => void
  readonly uiViews: Map<string, EffectUiView>
  readonly network: EgressRouter
  readonly reloadApp: (appId: string) => Promise<ReloadOutcome>
  readonly bundleFailures: () => readonly string[]
  readonly listen: ReturnType<typeof makeManagedListeners>["listen"]
  readonly listeners: ReturnType<typeof makeManagedListeners>["list"]
  readonly kernelRevision: () => KernelRevision | undefined
  readonly kernelBoot: () => BootResult<KernelInstance> | undefined
  readonly stageKernel: (revision: KernelRevision) => Promise<StageResult<KernelInstance>>
  readonly stop: () => Promise<void>
}
export const csv = (raw: string | undefined): readonly string[] =>
  (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)
