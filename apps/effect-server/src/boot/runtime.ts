import { resolve } from "node:path"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { makeDispatchPoint, makePluginHost, type DispatchPoint } from "@effect-agent/effect-host"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeConfigRegistry, makeSqliteConfigStore } from "@effect-agent/effect-config"
import {
  kernelRevision, makeKernelStateFile, makeMemoryKernelRepo, makeKernelSupervisor,
  type BootResult, type KernelRevision, type KernelRepo, type KernelSupervisor, type StageResult,
} from "@effect-agent/effect-bundle"
import type { EffectUiView } from "@effect-agent/effect-ui"
import { discoverManifests } from "../yaml-manifest.ts"
import { bootManifests } from "../load-manifest.ts"
import type { LoadContext } from "../load-manifest.ts"
import { makeConfigRuntime } from "../config-runtime/runtime.ts"
import { configFileFrom } from "../config-runtime/config-file.ts"
import { registerInfra, makeAppCatalog } from "./infra.ts"
import { assertKernelBootable, HOST, SHIPPED_REVISION } from "./kernel.ts"
import { makeAppLayer } from "./app-layer.ts"
import { makeAppReloader } from "./reload.ts"
import { makeBundleReloader } from "./bundle-reload.ts"
import { makeSourceWatcher } from "./watch.ts"
import { sweep } from "../manifest-loader/generation.ts"
import { disposeAll } from "./dispose.ts"
import { networkConfig } from "../network/config.ts"
import { makeNetworkRuntime } from "../network/runtime.ts"
import { makeManagedListeners } from "../network/listeners.ts"
import { KERNEL_PLANES, type KernelContext, type KernelInstance } from "../kernel/index.ts"
import { loadKernel, planeStandIn } from "../kernel/load.ts"
import type { EffectServer, EffectServerOptions } from "./options.ts"
import type { AppReloader, ReloadOutcome } from "./reload-types.ts"

export const bootRuntime = async (
  roots: readonly string[], enabled: ReadonlySet<string>, options: EffectServerOptions,
): Promise<EffectServer> => {
  // Fail loud before any state exists: a kernel the host cannot run must not get
  // as far as opening a database (§5 gate, §6.1 bootstrap ABI).
  const declaration = assertKernelBootable(options.kernel)
  if (process.env.EFFECT_KERNEL_LOG === "1") console.error(`[effect-server] kernel ${declaration.kernelId}`)
  const active = new Set(enabled)
  if (active.has("mcp-gateway")) active.add("mcp-registry") // satisfies the gateway's declared requires
  // Reloading is the one capability the host is handed *after* construction: the
  // reloader shares slots with the app layer, and that layer is built from this
  // host. The binding is read per request, never while booting.
  let reloader: AppReloader | undefined
  /** Bound once the app layer exists, but read per request — never while booting. */
  let bundles: ReturnType<typeof makeBundleReloader> | undefined
  const reloadApp = async (id: string): Promise<ReloadOutcome> => {
    // A bundle is not in the app layer, so it has no slot for `reloader` to
    // rebuild. Its own compile-and-connect-back answers for it instead.
    if (bundles?.owns(id) === true) return bundles.reload(id)
    return reloader?.reload(id) ?? { appId: id, ok: false, generation: 0, reason: "not-loaded" }
  }
  const host = makePluginHost({ control: options.control, reload: reloadApp })
  const registry = makeEffectRegistry()
  const mcpRegistry = makeRegistry()
  const configFile = configFileFrom(options.configFile)
  const store = makeSqliteConfigStore({ file: configFile })
  const configs = makeConfigRegistry({ store })
  // §6.2's single pointer. The listener and the routing table never mention a
  // kernel; they mention this, and this points at whichever kernel is current.
  const point: DispatchPoint<KernelInstance> = makeDispatchPoint<KernelInstance>()
  let cleanup = async () => { await host.close(); store.close() }
  try {
  configs.register(networkConfig)
  let networkRuntime: ReturnType<typeof makeNetworkRuntime>
  let listeners: ReturnType<typeof makeManagedListeners>
  const failedReloads = new Set<string>()
  const configRuntime = makeConfigRuntime(configs, async (id) => {
    if (id === networkConfig.appId) { networkRuntime.reload(); await listeners.reload(); return }
    if (!host.list().some((p) => p.id === id)) return
    const wasEnabled = host.isEnabled(id)
    if (!wasEnabled && !failedReloads.has(id)) return
    if (wasEnabled) await host.disable(id)
    if (!await host.enable(id)) {
      failedReloads.add(id)
      throw new Error(`Plugin ${id} could not activate saved configuration`)
    }
    failedReloads.delete(id)
  }, { storeFile: configFile })
  configRuntime.initialize(networkConfig.appId, { yaml: options.network })
  networkRuntime = makeNetworkRuntime(() => configRuntime.active(networkConfig.appId))
  const network = networkRuntime.network
  listeners = makeManagedListeners(host, () => configRuntime.active(networkConfig.appId))
  const uiViews = new Map<string, EffectUiView>()
  const yaml = new Map(discoverManifests(roots).map((d) => [d.manifest.id, d.manifest.config]))
  const initializeConfig = (id: string) => configRuntime.initialize(id, { yaml: yaml.get(id) })

  // The catalog is a live view over services that outlive every kernel (§4), so it
  // is built here and handed to each revision rather than owned by one.
  const catalog = makeAppCatalog({ host, registry, configs, uiViews })
  const context: KernelContext = {
    host, registry, configs, configRuntime, network, mcpRegistry, uiViews, catalog,
    enabled: active, yamlOf: (id) => yaml.get(id), observationFile: process.env.EFFECT_OBSERVE_FILE,
    dev: options.dev,
  }

  const repo: KernelRepo = options.kernelRepo ?? (options.kernelStateFile === undefined
    ? makeMemoryKernelRepo()
    : makeKernelStateFile(options.kernelStateFile))
  const loadContext: LoadContext = {
    host, registry, mcpRegistry, configs, uiViews, network,
    initializeConfig,
    activeConfig: (id) => configRuntime.active(id),
  }
  // §6.3-② / §6.5-6's app layer, declared before the supervisor because it is what
  // the supervisor's `apps` and `rebuild` halves are about.
  const appLayer = makeAppLayer({ load: (only) => bootManifests(loadContext, roots, active, only) })
  // §6.4's single-app replacement. It shares the layer's slots rather than keeping
  // its own, so a reloaded app is in the same place in load order it was before,
  // and `stop()` tears down the generation actually serving.
  reloader = makeAppReloader({
    roots, context: loadContext, loaded: appLayer.appIds,
    swap: (id, dispose) => appLayer.swap(id, dispose),
  })
  // The second load path, owned here for the same reason the first is: an app the
  // server compiles is still an app the server runs, and `reloadApp` has to be
  // able to reach it. Its context is the layer's, so both paths register into one
  // host, one registry, and one view table.
  bundles = options.bundles === undefined ? undefined : makeBundleReloader({
    apps: options.bundles,
    root: options.bundleRoot ?? resolve(".effect-bundles"),
    api: {
      host, registry, mcpRegistry, configs, uiViews, network, namespace: "ops",
      initializeConfig, activeConfig: (id) => configRuntime.active(id),
    },
  })
  const supervisor: KernelSupervisor<KernelInstance> = makeKernelSupervisor<KernelInstance>({
    repo,
    load: (revision) => loadKernel(revision, context),
    activate: (kernel) => { point.activate(kernel) },
    probe: async (slot) => {
      // The host owns the slot list, so the host checks that a candidate fills it.
      // A kernel that declares a smaller operation set than the routing table has
      // slots for would leave holes reachable by URL — refuse it while the old
      // kernel is still serving, not on the first request that finds the hole.
      for (const spec of KERNEL_PLANES) {
        if (spec.always !== true && !active.has(spec.id)) continue
        if (!slot.kernel.planes.has(spec.id)) {
          throw new Error(`kernel ${slot.kernel.id} leaves slot ${spec.id} unfilled`)
        }
      }
      await slot.kernel.health()
    },
    // §6.2's invariant, enforced rather than described: retire waits for A's
    // in-flight requests, and only then does A stop.
    dispose: async (kernel) => { await point.retire(kernel); await kernel.dispose() },
    apps: () => appLayer.declared(),
    // §6.3-②: an effect-line move is paid for by suspending the apps it would
    // break and loading them back — and by nothing else. §6.5-6: the apps the
    // matrix cleared keep serving for the whole swap.
    rebuild: {
      teardown: (apps) => appLayer.suspend(apps),
      replay: (apps) => appLayer.restore(apps),
    },
    host: HOST,
    onEvent: (event) => { if (process.env.EFFECT_KERNEL_LOG === "1") console.error(`[effect-server] kernel ${event.kind}`) },
  })

  // Development only (see watch.ts): the trigger that makes reloading an app part
  // of saving a file rather than a command to remember.
  const watcher = options.dev !== true ? undefined : makeSourceWatcher({
    roots, reload: reloadApp,
    onOutcome: (outcome) => console.error(`[effect-server] reload ${outcome.appId}: `
      + (outcome.ok ? `ok (generation ${outcome.generation})` : `${outcome.reason}`)),
  })

  let closed = false
  let boot: BootResult<KernelInstance> | undefined
  let bundleFailures: readonly string[] = []
  const app: EffectServer = {
    host, registry, mcpRegistry, configs, configRuntime, initializeConfig, uiViews, network,
    reloadApp,
    bundleFailures: () => bundleFailures,
    listen: listeners.listen, listeners: listeners.list,
    kernelRevision: () => supervisor.active()?.revision,
    kernelBoot: () => boot,
    stageKernel: (revision: KernelRevision): Promise<StageResult<KernelInstance>> => supervisor.stage(revision),
    stop: async () => {
      if (closed) return
      closed = true
      // The active kernel is not "retired" — nothing displaces it — so it is
      // stopped directly, after the listener has stopped feeding it requests.
      const kernel = supervisor.active()?.kernel
      await disposeAll([() => watcher?.close(), ...roots.map((root) => () => sweep(root)), listeners.close, ...appLayer.running().slice().reverse(), ...(bundles?.running() ?? []).slice().reverse(), () => point.activate(undefined),
        ...(kernel === undefined ? [] : [() => kernel.dispose()]), () => host.close(), () => store.close()])
    },
  }
    cleanup = app.stop
    // One stable entry per plane slot: ids and priorities are the host's, and they
    // do not move when a kernel does (§6.3-①). Inert until a kernel is activated.
    for (const spec of KERNEL_PLANES) {
      if (spec.always !== true && !active.has(spec.id)) continue
      await host.register(planeStandIn(spec, point))
    }
    await appLayer.boot()
    registerInfra(app, catalog)
    // Last, and only after every app is registered: the kernel's planes load
    // against a registry that already knows the apps they serve.
    boot = await supervisor.boot(kernelRevision(declaration, SHIPPED_REVISION))
    // Last, after the kernel is serving: a bundle connects back into a host that
    // is already up, exactly as the launcher used to do it. One that will not load
    // is that app's failure and not the home's — it is reported, not thrown.
    if (bundles !== undefined) bundleFailures = await bundles.install()
    return app
  } catch (error) { await cleanup(); throw error }
}
