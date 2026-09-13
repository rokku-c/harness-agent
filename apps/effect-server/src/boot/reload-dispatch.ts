/**
 * Which reloader answers for an app id — the one seam that must exist *before*
 * either load path does.
 *
 * `makePluginHost` takes its `reload` at construction, but the app layer and the
 * bundle reloader are both built from that host, so neither exists yet. This holds
 * the two bindings instead: bound once while booting, read on every request.
 *
 * The paths are not interchangeable. A bundle-managed app never enters the app
 * layer, so `reload.ts` cannot see it; its own compile-and-connect-back answers
 * for it instead (bundle-reload.ts). That is why the bundle path is asked first.
 */

import type { BundleReloader } from "./bundle-reload.ts"
import type { AppReloader, ReloadOutcome } from "./reload-types.ts"

export interface ReloadDispatch {
  /** Bind both paths once they are built. Read per request; never called while booting. */
  bind(apps: AppReloader, bundles?: BundleReloader): void
  reload(appId: string): Promise<ReloadOutcome>
}

export const makeReloadDispatch = (): ReloadDispatch => {
  let apps: AppReloader | undefined
  let bundles: BundleReloader | undefined
  return {
    bind: (appReloader, bundleReloader) => { apps = appReloader; bundles = bundleReloader },
    reload: async (appId) => bundles?.owns(appId) === true
      ? bundles.reload(appId)
      : apps?.reload(appId) ?? { appId, ok: false, generation: 0, reason: "not-loaded" },
  }
}
