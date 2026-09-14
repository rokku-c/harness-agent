import { resolve } from "node:path"
import type { AppCatalog } from "@effect-agent/effect-apps"
import { bootManifests } from "../load-manifest.ts"
import type { LoadContext } from "../load-manifest.ts"
import { makeHostCatalog } from "./infra.ts"
import { makeAppLayer, type AppLayer } from "./app-layer.ts"
import { makeAppReloader } from "./reload.ts"
import { makeBundleReloader, type BundleReloader } from "./bundle-reload.ts"
import { makeSourceWatcher, type SourceWatcher } from "./watch.ts"
import type { EffectServerOptions } from "./options.ts"
import type { ReloadDispatch } from "./reload-dispatch.ts"
import type { BootServices } from "./services.ts"

export interface AppRuntime {
  readonly catalog: AppCatalog
  readonly loadContext: LoadContext
  readonly layer: AppLayer
  readonly bundles?: BundleReloader
  readonly watcher?: SourceWatcher
}

export const makeAppRuntime = (
  services: BootServices,
  options: EffectServerOptions,
  dispatch: ReloadDispatch,
  roots: readonly string[],
  active: ReadonlySet<string>,
): AppRuntime => {
  const { host, registry, mcpRegistry, mcpSets, configs, configRuntime, uiViews, network, initializeConfig } = services
  const catalog = makeHostCatalog({ host, registry, configs, uiViews })
  const loadContext: LoadContext = {
    host, registry, mcpRegistry, mcpSets, configs, uiViews, network, initializeConfig,
    activeConfig: (id) => configRuntime.active(id),
  }
  const layer = makeAppLayer({ load: (only) => bootManifests(loadContext, roots, active, only) })
  const reloader = makeAppReloader({
    roots, context: loadContext, loaded: layer.appIds,
    swap: (id, dispose) => layer.swap(id, dispose),
  })
  const bundles = options.bundles === undefined ? undefined : makeBundleReloader({
    apps: options.bundles,
    root: options.bundleRoot ?? resolve(".effect-bundles"),
    api: {
      host, registry, mcpRegistry, mcpSets, configs, uiViews, network, namespace: "ops",
      initializeConfig, activeConfig: (id) => configRuntime.active(id),
    },
  })
  dispatch.bind(reloader, bundles)
  return {
    catalog, loadContext, layer, bundles,
    watcher: options.dev !== true ? undefined : makeSourceWatcher({
      roots, reload: dispatch.reload,
      onOutcome: (outcome) => console.error(`[effect-server] reload ${outcome.appId}: `
        + (outcome.ok ? `ok (generation ${outcome.generation})` : `${outcome.reason}`)),
    }),
  }
}
