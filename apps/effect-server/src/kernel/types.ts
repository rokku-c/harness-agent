/**
 * What a kernel is, from the host's side (docs/architecture-rework.md §6.1–§6.3).
 *
 * §6.1 splits the running system into host invariants and the kernel artifact.
 * Implementing that split forced one refinement the first draft did not have, and
 * it is worth stating plainly because it decides what a kernel artifact may touch:
 *
 *   **The kernel is code. Anything holding a process-level handle is not.**
 *
 * The SQLite store, the listeners and the sockets belong to the boot phase because
 * they are the three live handles P1's §7.6 finding named as the real blockers for
 * an in-place swap. So those are *services*: built once by the bootstrap and handed
 * to every kernel revision. A kernel revision supplies **behavior** — the planes —
 * and inherits the state. That is also exactly why a compatible swap needs no app
 * rebuild: the app-visible services keep their identity across the flip, and only
 * the implementation behind them changes (§6.3-①).
 *
 * The second thing the split forced: the app-registration table (the plugin host)
 * must be a host invariant too. If each kernel owned its own host, swapping kernels
 * would drop every loaded app, which is §6.3-② (full rebuild) — the expensive path,
 * and the one the user explicitly said a *compatible* kernel must not need. Apps
 * register into the stable host once; the kernel owns only its own planes.
 */

import type { EgressRouter } from "@effect-agent/effect-network"
import type { EffectPluginHost, LoadedPlane, RoutePattern } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { AppCatalog } from "@effect-agent/effect-apps"
import type { KernelRevision } from "@effect-agent/effect-bundle"
import type { ConfigRuntime } from "../config-runtime/types.ts"

/** One slot a kernel fills. The bootstrap registers a stable stand-in per id. */
export interface KernelPlaneSpec {
  readonly id: string
  readonly priority: number
  /** Path claims, for planes that match by route rather than by `canHandle`. */
  readonly routes?: readonly RoutePattern[]
  /**
   * Registered regardless of the enabled set — the control plane's own transport
   * cannot be gated on a plane that only exists once some other plane ran.
   */
  readonly always?: boolean
}

/**
 * The planes this build's kernel fills, and therefore the slots the host opens.
 * Ids and priorities are host-side data on purpose: a kernel revision supplies the
 * implementations, not the routing table (§6.3-① — the routing table does not move).
 */
export const KERNEL_PLANES: readonly KernelPlaneSpec[] = [
  { id: "platform-network", priority: 0, always: true, routes: [{ path: "/-/network/egress" }, { path: "/-/network/routes", method: "GET" }] },
  { id: "monitor", priority: 14 },
  { id: "effect-apps", priority: 15 },
  { id: "console", priority: 90 },
  { id: "config", priority: 150 },
]

export const planeIdsOf = (specs: readonly KernelPlaneSpec[], enabled: ReadonlySet<string>): readonly string[] =>
  specs.filter((spec) => spec.always === true || enabled.has(spec.id)).map((spec) => spec.id)

/** Everything a kernel revision is given. Built once; survives every swap. */
export interface KernelContext {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly configRuntime: ConfigRuntime
  readonly network: EgressRouter
  readonly mcpRegistry: McpRegistry
  readonly uiViews: Map<string, EffectUiView>
  readonly catalog: AppCatalog
  readonly enabled: ReadonlySet<string>
  readonly yamlOf: (appId: string) => unknown
  readonly namespace?: string
  readonly observationFile?: string
  /** Development mode (see boot/watch.ts): source is rebuilt rather than shipped. */
  readonly dev?: boolean
  /** Which revision this instance was built for, when it came from the repo. */
  readonly revision?: KernelRevision
}

/**
 * A loaded kernel: the planes it built, and the means to stop them. `id` is what
 * the dispatch point names in logs and in its refusal to retire the active target.
 */
export interface KernelInstance {
  readonly id: string
  readonly planes: ReadonlyMap<string, LoadedPlane>
  /** (Re)build one plane — used when the control plane re-enables a slot. */
  start(planeId: string): Promise<void>
  /** Stop one plane without retiring the kernel. */
  stop(planeId: string): Promise<void>
  /** Health check the kernel runs on itself (§6.5-2). Throwing refuses the stage. */
  health(): Promise<void>
  /** Stop every plane this instance built. */
  dispose(): Promise<void>
}

/**
 * The artifact contract, and the only one: a kernel directory's entry module
 * default-exports this. The shipped kernel satisfies it too, so "this build's
 * kernel" and "a kernel pushed to the artifact repo" are loaded by the same code
 * path — which is the point of §6.2's claim that the switch does not change.
 */
export type KernelFactory = (context: KernelContext) => Promise<KernelInstance> | KernelInstance

/** A kernel artifact under `.effect-bundles/`; the shape P6 pushes. */
export interface KernelArtifact {
  readonly entry: string
}
