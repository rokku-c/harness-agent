import type { BundleReloader } from "./bundle-reload.ts"
import type { AppReloader, ReloadOutcome } from "./reload-types.ts"

export interface ReloadDispatch {
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
