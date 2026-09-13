/**
 * The kernel half of boot: §6.2's single pointer, the artifact repo, and the
 * supervisor that adjudicates a swap.
 *
 * The listener and the routing table never mention a kernel; they mention the
 * dispatch point, and it points at whichever kernel is current. So the pointer is
 * created here while the host registers one stable plane stand-in per slot against
 * it (kernel/load.ts) — ids, priorities and the routing table do not move when a
 * kernel does (§6.3-①). Registering the stand-ins is left to the caller because it
 * is the first step that touches the host, and boot owns that order.
 */

import { makeDispatchPoint, type DispatchPoint } from "@effect-agent/effect-host"
import {
  makeKernelStateFile, makeMemoryKernelRepo, makeKernelSupervisor,
  type KernelRepo, type KernelSupervisor,
} from "@effect-agent/effect-bundle"
import { KERNEL_PLANES, planeIsOn, type KernelContext, type KernelInstance } from "../kernel/index.ts"
import { loadKernel, planeStandIn } from "../kernel/load.ts"
import { HOST } from "./kernel.ts"
import type { AppRuntime } from "./app-runtime.ts"
import type { BootServices } from "./services.ts"
import type { EffectServerOptions } from "./options.ts"

export interface KernelRuntime {
  readonly point: DispatchPoint<KernelInstance>
  readonly supervisor: KernelSupervisor<KernelInstance>
  /** One stable entry per enabled plane slot. Inert until a kernel is activated. */
  registerStandIns(): Promise<void>
}

export const makeKernelRuntime = (
  services: BootServices,
  apps: AppRuntime,
  options: EffectServerOptions,
  active: ReadonlySet<string>,
): KernelRuntime => {
  const { host, registry, mcpRegistry, configs, configRuntime, network, uiViews } = services
  const point = makeDispatchPoint<KernelInstance>()
  const context: KernelContext = {
    host, registry, configs, configRuntime, network, mcpRegistry, uiViews, catalog: apps.catalog,
    enabled: active,
    yamlOf: (id) => services.yaml.get(id),
    observationFile: process.env.EFFECT_OBSERVE_FILE,
    dev: options.dev,
  }
  const repo: KernelRepo = options.kernelRepo ?? (options.kernelStateFile === undefined
    ? makeMemoryKernelRepo()
    : makeKernelStateFile(options.kernelStateFile))
  const supervisor = makeKernelSupervisor<KernelInstance>({
    repo,
    load: (revision) => loadKernel(revision, context),
    activate: (kernel) => { point.activate(kernel) },
    probe: async (slot) => {
      // The host owns the slot list, so the host checks that a candidate fills it.
      // A kernel declaring a smaller operation set than the routing table has slots
      // for would leave holes reachable by URL — refuse it while the old kernel is
      // still serving, not on the first request that finds the hole.
      for (const spec of KERNEL_PLANES) {
        if (!planeIsOn(spec, active)) continue
        if (!slot.kernel.planes.has(spec.id)) {
          throw new Error(`kernel ${slot.kernel.id} leaves slot ${spec.id} unfilled`)
        }
      }
      await slot.kernel.health()
    },
    // §6.2's invariant, enforced rather than described: retire waits for the old
    // kernel's in-flight requests, and only then does it stop.
    dispose: async (kernel) => { await point.retire(kernel); await kernel.dispose() },
    apps: () => apps.layer.declared(),
    // §6.3-②: an effect-line move is paid for by suspending the apps it would break
    // and loading them back — and by nothing else. §6.5-6: the apps the matrix
    // cleared keep serving for the whole swap.
    rebuild: { teardown: (ids) => apps.layer.suspend(ids), replay: (ids) => apps.layer.restore(ids) },
    host: HOST,
    onEvent: (event) => {
      if (process.env.EFFECT_KERNEL_LOG === "1") console.error(`[effect-server] kernel ${event.kind}`)
    },
  })
  return {
    point,
    supervisor,
    registerStandIns: async () => {
      for (const spec of KERNEL_PLANES) {
        if (!planeIsOn(spec, active)) continue
        await host.register(planeStandIn(spec, point))
      }
    },
  }
}
