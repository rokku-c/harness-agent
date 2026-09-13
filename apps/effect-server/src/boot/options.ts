import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
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
  /**
   * Watch app sources and reload what changes. Off unless asked for: in
   * production a write under an app's directory is not an edit, and reloading on
   * one would be reloading on a build artifact.
   */
  readonly dev?: boolean
  readonly configFile?: string
  readonly network?: unknown
  /**
   * Which kernel to run. Defaults to the one this build ships (boot/kernel.ts);
   * the supervisor (§6.2, P5) supplies the staged artifact's declaration here,
   * which is what makes the bootstrap-ABI gate refuse a real mismatch.
   */
  readonly kernel?: KernelDeclaration
  /**
   * Where the kernel index lives (§6.1's artifact repo). Absent = in memory, which
   * is what tests and embedded hosts want; the server entry point passes
   * `.effect-bundles/kernel-state.json` so a crash-restart has something to fall
   * back to.
   */
  readonly kernelStateFile?: string
  /** Injectable index, for hosts that keep kernel state somewhere else. */
  readonly kernelRepo?: KernelRepo
  /**
   * Apps this host compiles and connects back rather than loading from source
   * (bundle-reload.ts). Providing them here is what puts them under the same
   * `reloadApp` as every other app; a host that loads its bundles itself gets
   * `not-loaded` for them and no way to say otherwise.
   */
  readonly bundles?: readonly BundleApp[]
  /** Where a bundle's generations are compiled. Defaults to `.effect-bundles` in the working directory. */
  readonly bundleRoot?: string
}
export interface EffectServer {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly mcpRegistry: McpRegistry
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  readonly initializeConfig: (appId: string) => void
  readonly uiViews: Map<string, EffectUiView>
  readonly network: EgressRouter
  /**
   * Reload one app from its source in place (§6.4): a fresh module, adjudicated
   * against the surface already registered, with the serving generation put back
   * when the incoming one is rejected or fails to load. Answers where it got to
   * rather than throwing, because "refused, still serving" is a result.
   */
  readonly reloadApp: (appId: string) => Promise<ReloadOutcome>
  /**
   * The bundle-managed apps that would not load, if any. They are not up, and
   * the host has already marked their entries disabled — this exists so the
   * launcher can name them rather than leaving the operator to find the reason
   * in the log.
   */
  readonly bundleFailures: () => readonly string[]
  readonly listen: ReturnType<typeof makeManagedListeners>["listen"]
  readonly listeners: ReturnType<typeof makeManagedListeners>["list"]
  /** The kernel revision currently serving, if one booted. */
  readonly kernelRevision: () => KernelRevision | undefined
  /** How boot went — present when the recorded active revision had to be abandoned. */
  readonly kernelBoot: () => BootResult<KernelInstance> | undefined
  /**
   * Swap to another kernel revision (§6.2). Refuses an incompatible one, and on
   * failure leaves the active kernel serving — this is the entry point P6's
   * artifact push uses.
   */
  readonly stageKernel: (revision: KernelRevision) => Promise<StageResult<KernelInstance>>
  readonly stop: () => Promise<void>
}
export const csv = (raw: string | undefined): readonly string[] =>
  (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)
