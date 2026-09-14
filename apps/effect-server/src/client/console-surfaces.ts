import type { ConfigApi } from "./config-api.ts"
import type { ConfigMountFactory } from "./config-spec.ts"

export interface ConsoleSurfaces {
  readonly config: { readonly api: ConfigApi; readonly mountConfig: ConfigMountFactory }
}
