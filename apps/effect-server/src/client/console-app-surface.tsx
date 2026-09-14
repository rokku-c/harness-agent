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
