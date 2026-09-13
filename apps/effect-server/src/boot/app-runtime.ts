/**
 * The app half of boot: what an app is loaded *into*, and the two load paths.
 *
 * One `LoadContext` serves both paths — `effect.yaml` boot and bundle
 * connect-back — so both register into one host, one registry and one view table.
 * The catalog is built here for the same reason the services are: §4's table is a
 * live view over services that outlive a kernel, so every revision shares it.
 *
 * `layer` is what §6.5-6 suspends and restores by name. The two reloaders are not
 * called directly — they are bound into the dispatch the host already holds
 * (reload-dispatch.ts), because the host is the one that routes a reload request.
 */

import { resolve } from "node:path"
import type { AppCatalog } from "@effect-agent/effect-apps"
import { bootManifests } from "../load-manifest.ts"
import type { LoadContext } from "../load-manifest.ts"
import { makeAppCatalog } from "./infra.ts"
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
  const { host, registry, mcpRegistry, configs, configRuntime, uiViews, network, initializeConfig } = services
  const catalog = makeAppCatalog({ host, registry, configs, uiViews })
  const loadContext: LoadContext = {
    host, registry, mcpRegistry, configs, uiViews, network, initializeConfig,
    activeConfig: (id) => configRuntime.active(id),
  }
  const layer = makeAppLayer({ load: (only) => bootManifests(loadContext, roots, active, only) })
  const reloader = makeAppReloader({
    roots, context: loadContext, loaded: layer.appIds,
    swap: (id, dispose) => layer.swap(id, dispose),
  })
  // The second load path is owned here for the same reason the first is: an app
  // the server compiles is still an app the server runs, and a reload has to reach
  // it. Its context is the layer's, so both paths share one host and one registry.
  const bundles = options.bundles === undefined ? undefined : makeBundleReloader({
    apps: options.bundles,
    root: options.bundleRoot ?? resolve(".effect-bundles"),
    api: {
      host, registry, mcpRegistry, configs, uiViews, network, namespace: "ops",
      initializeConfig, activeConfig: (id) => configRuntime.active(id),
    },
  })
  dispatch.bind(reloader, bundles)
  return {
    catalog, loadContext, layer, bundles,
    // Development only (watch.ts): the trigger that makes reloading part of saving
    // a file rather than a command to remember.
    watcher: options.dev !== true ? undefined : makeSourceWatcher({
      roots, reload: dispatch.reload,
      onOutcome: (outcome) => console.error(`[effect-server] reload ${outcome.appId}: `
        + (outcome.ok ? `ok (generation ${outcome.generation})` : `${outcome.reason}`)),
    }),
  }
}
