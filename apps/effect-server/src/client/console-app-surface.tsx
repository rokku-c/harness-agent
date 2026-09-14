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
import { Skeleton } from "@radix-ui/themes"
import { hashOf } from "./console-nav.ts"
import { Freshness } from "./console-freshness.tsx"
import { useSource, sourceValue } from "./console-source.ts"
import { isView, loadView } from "./console-view-read.ts"
import { NotFound } from "./console-not-found.tsx"
import { ConfigEditor } from "./console-config-editor.tsx"
import { EffectUiRuntime } from "./effect-ui-runtime.tsx"
import { paramsOf, unresolved, type Address, type ConsoleRoute } from "./console-route.ts"
import type { PlaceContext, Surface } from "./console-place.ts"

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
  /**
   * Keyed by the app, so walking from one app to another is a new mount and a new
   * store (effect-ui-view-state.tsx seeds one per mount, and a view's state is the
   * app's own). A *screen* change is the same mount, which is what keeps a draft
   * alive across it, and a re-read of the payload is the same mount too — a view
   * read again is still the view the operator is working in.
   */
  return <EffectUiRuntime key={route.id} runtime={{
    appId: route.id,
    title: context.plan.find((entry) => entry.id === route.id)?.title ?? route.id,
    screens: payload.screens,
    menu: payload.menu,
    ...(payload.actions === undefined ? {} : { actions: payload.actions }),
    ...(payload.sources === undefined ? {} : { sources: payload.sources }),
  }} />
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
