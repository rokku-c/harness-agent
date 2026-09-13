/**
 * What the shell can put on screen, and how it hands it over.
 *
 * A view mounts a React root of its own into a node the shell owns, so it is
 * opened imperatively: `current` tells the opener whether that node is still on
 * screen, so a slow fetch cannot paint over the route the reader moved to, and
 * the returned disposer unmounts that root — a view polls its sources on a
 * timer, so leaving one mounted on a route nobody is looking at keeps it
 * fetching forever. A config form needs none of that — it is an ordinary
 * component, and this is what it needs to render itself.
 */

import type { ConfigApi } from "./config-api.ts"
import type { ConfigMountFactory } from "./config-spec.ts"

export type OpenPanel = (panel: HTMLElement, id: string, current: () => boolean) => Promise<() => void>

export interface ConsoleSurfaces {
  readonly view: OpenPanel
  readonly config: { readonly api: ConfigApi; readonly mountConfig: ConfigMountFactory }
}
