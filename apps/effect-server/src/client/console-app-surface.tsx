/**
 * The apps at their own address: `#app/<id>`, `#app/<id>/<screen>` and
 * `#app/<id>/settings`.
 *
 * This is the surface that answers an app address, and it is registered in the
 * same shape as the five places so the shell's dispatch stays one lookup. It is
 * not a place: its address carries an app id, so it does not exist with zero apps
 * registered.
 *
 * The claim resolves on shape and validates nothing, because the two facts an app
 * address can fail on arrive at different times. Whether an app is registered at
 * all is answered by the read below, and answering it here instead would make a
 * transient failure of the catalogue turn every app link in a bookmark into a
 * Not found. Whether a *screen* name exists cannot be known before the payload
 * lands even in principle — the screens are the app's, and the console holds no
 * list of them — so it is answered here, once, naming the app's real screens
 * (`flows.md` §2.H4).
 */

import * as React from "react"
import { Flex, Skeleton } from "@radix-ui/themes"
import { hashOf } from "./console-nav.ts"
import { Freshness } from "./console-freshness.tsx"
import { useSource, sourceValue } from "./console-source.ts"
import { isView, loadView, type ViewPayload } from "./console-view-read.ts"
import { NotFound } from "./console-not-found.tsx"
import { ConfigEditor } from "./console-config-editor.tsx"
import { paramsOf, unresolved, type Address, type ConsoleRoute } from "./console-route.ts"
import type { PlaceContext, Surface } from "./console-place.ts"

/**
 * Hosts the view the client bundle mounts. The bundle is a separate script with
 * its own React root, so this owns the lifetime: when the address moves on, the
 * effect's own cleanup unmounts the root instead of leaving it polling under the
 * new surface.
 */
const Mounted = ({ payload, appId }: { readonly payload: ViewPayload; readonly appId: string }) => {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    const api = window.effectUi
    if (node === null || api === undefined) return
    node.replaceChildren()
    return api.mount(node, {
      appId, screens: payload.screens, menu: payload.menu,
      ...(payload.actions === undefined ? {} : { actions: payload.actions }),
      ...(payload.sources === undefined ? {} : { sources: payload.sources }),
    })
  }, [payload, appId])
  // The pane the screens are laid out in, and the height they lay themselves out against.
  return <div className="view-fill" ref={ref} />
}

const AppScreen = ({ route, address, context }: {
  readonly route: Extract<ConsoleRoute, { kind: "app" }>
  /** The address as written, kept by Not found rather than rewritten (§2.H13). */
  readonly address: string
  readonly context: PlaceContext
}) => {
  const read = useSource(route.id, loadView)
  const payload = sourceValue(read.state)
  if (read.state.status === "failed" && payload === undefined) return <Freshness state={read.state} onRetry={read.retry} />
  if (payload === undefined) return <Skeleton style={{ flex: "1 1 auto" }} />
  if (!isView(payload)) return <NotFound address={address} part="app" text={route.id} plan={context.plan} />
  if (route.screen !== undefined && !payload.screens.some((screen) => screen.id === route.screen)) {
    return <NotFound address={address} part="screen" text={route.screen} app={route.id} plan={context.plan}
      screens={payload.screens.map((screen) => ({ id: screen.id, title: screen.title }))} />
  }
  return <Mounted payload={payload} appId={route.id} />
}

export const APP: Surface = {
  kinds: ["app", "app-settings"],
  chrome: "fill",
  claim: (address: Address): ConsoleRoute | undefined => {
    if (address.parts[0] !== "app") return undefined
    const id = address.parts[1]
    if (id === undefined) return unresolved(address, "app", "")
    if (address.parts[2] === "settings") return { kind: "app-settings", id }
    const params = paramsOf(address.query)
    const screen = address.parts[2]
    return { kind: "app", id, ...(screen === undefined ? {} : { screen }), ...(Object.keys(params).length === 0 ? {} : { params }) }
  },
  view: (route, context) => {
    if (route.kind === "app-settings") return <ConfigEditor id={route.id} plan={context.plan} surfaces={context.surfaces} />
    if (route.kind !== "app") return null
    return <AppScreen route={route} address={hashOf(route)} context={context} />
  },
}
