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
  registerStandIns(): Promise<void>
}

export const makeKernelRuntime = (
  services: BootServices,
  apps: AppRuntime,
  options: EffectServerOptions,
  active: ReadonlySet<string>,
): KernelRuntime => {
  const { host, registry, mcpRegistry, mcpSets, configs, configRuntime, network, uiViews } = services
  const point = makeDispatchPoint<KernelInstance>()
  const context: KernelContext = {
    host, registry, configs, configRuntime, network, mcpRegistry, mcpSets, uiViews, catalog: apps.catalog,
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
      for (const spec of KERNEL_PLANES) {
        if (!planeIsOn(spec, active)) continue
        if (!slot.kernel.planes.has(spec.id)) {
          throw new Error(`kernel ${slot.kernel.id} leaves slot ${spec.id} unfilled`)
        }
      }
      await slot.kernel.health()
    },
    dispose: async (kernel) => { await point.retire(kernel); await kernel.dispose() },
    apps: () => apps.layer.declared(),
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
