import { sweep } from "../manifest-loader/generation.ts"
import { registerInfra } from "./infra.ts"
import { assertKernelBootable, SHIPPED_REVISION } from "./kernel.ts"
import {
  kernelRevision, type BootResult, type KernelRevision, type StageResult,
} from "@effect-agent/effect-bundle"
import { disposeAll } from "./dispose.ts"
import { makeReloadDispatch } from "./reload-dispatch.ts"
import { makeServices } from "./services.ts"
import { makeAppRuntime } from "./app-runtime.ts"
import { makeKernelRuntime } from "./kernel-runtime.ts"
import type { KernelInstance } from "../kernel/index.ts"
import type { EffectServer, EffectServerOptions } from "./options.ts"

export const bootRuntime = async (
  roots: readonly string[],
  enabled: ReadonlySet<string>, options: EffectServerOptions,
): Promise<EffectServer> => {
  const declaration = assertKernelBootable(options.kernel)
  if (process.env.EFFECT_KERNEL_LOG === "1") console.error(`[effect-server] kernel ${declaration.kernelId}`)
  const active = new Set(enabled)
  if (active.has("mcp-gateway")) active.add("mcp-registry")
  if (active.has("mcp-gateway")) active.add("agentd")
  const dispatch = makeReloadDispatch()
  const services = makeServices(roots, options, dispatch.reload)

  let cleanup = services.close
  try {
    const apps = makeAppRuntime(services, options, dispatch, roots, active)
    const kernel = makeKernelRuntime(services, apps, options, active)
    let closed = false
    let boot: BootResult<KernelInstance> | undefined
    let bundleFailures: readonly string[] = []
    const app: EffectServer = {
      host: services.host, registry: services.registry, mcpRegistry: services.mcpRegistry,
      mcpSets: services.mcpSets,
      configs: services.configs, configRuntime: services.configRuntime,
      initializeConfig: services.initializeConfig, uiViews: services.uiViews, network: services.network,
      reloadApp: dispatch.reload,
      bundleFailures: () => bundleFailures,
      listen: services.listeners.listen, listeners: services.listeners.list,
      kernelRevision: () => kernel.supervisor.active()?.revision,
      kernelBoot: () => boot,
      stageKernel: (revision: KernelRevision): Promise<StageResult<KernelInstance>> =>
        kernel.supervisor.stage(revision),
      stop: async () => {
        if (closed) return
        closed = true
        const live = kernel.supervisor.active()?.kernel
        await disposeAll([
          () => apps.watcher?.close(),
          ...roots.map((root) => () => sweep(root)),
          services.listeners.close,
          ...apps.layer.running().slice().reverse(),
          ...(apps.bundles?.running() ?? []).slice().reverse(),
          () => kernel.point.activate(undefined),
          ...(live === undefined ? [] : [() => live.dispose()]),
          services.close,
        ])
      },
    }
    cleanup = app.stop

    await kernel.registerStandIns()
    await apps.layer.boot()
    registerInfra(app, apps.catalog)
    boot = await kernel.supervisor.boot(kernelRevision(declaration, SHIPPED_REVISION))
    if (apps.bundles !== undefined) bundleFailures = await apps.bundles.install()
    return app
  } catch (error) { await cleanup(); throw error }
}
