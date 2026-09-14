/**
 * What the shell is handed to pass down: the config editor's two dependencies,
 * and nothing else.
 *
 * An app's declarative view used to be here too, as an imperative opener that
 * fetched the payload and mounted whichever surface the server named. That
 * opener is gone with the address split (`flows.md` §1.6): a view address is a
 * view and a tools address is a tool set, so the app's payload may now fail to
 * be a surface at all — the app may have no view, or no screen by that name —
 * and an outcome of the route belongs where the route is rendered, not inside a
 * fetch that has already been told what to do. `console-app-surface.tsx` reads
 * the payload and decides; this is what the places that render config need.
 */

import type { ConfigApi } from "./config-api.ts"
import type { ConfigMountFactory } from "./config-spec.ts"

export interface ConsoleSurfaces {
  readonly config: { readonly api: ConfigApi; readonly mountConfig: ConfigMountFactory }
}
