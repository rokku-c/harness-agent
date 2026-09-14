import * as React from "react"
import { NotFound } from "./console-not-found.tsx"
import { HOME } from "./console-home.tsx"
import { INBOX } from "./console-place-inbox.tsx"
import { ACTIVITY } from "./console-place-activity.tsx"
import { TOOLS } from "./console-place-tools.tsx"
import { SETTINGS } from "./console-place-settings.tsx"
import { APP } from "./console-app-surface.tsx"
import { parseAddress, unresolved, type ConsoleRoute } from "./console-route.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { Place, Surface } from "./console-place.ts"

export const PLACES: readonly Place[] = [HOME, INBOX, ACTIVITY, TOOLS, SETTINGS]

const NOT_FOUND: Surface = {
  kinds: ["not-found"],
  chrome: "page",
  claim: () => undefined,
  view: (route, context) => route.kind === "not-found"
    ? <NotFound address={route.address} part={route.part} text={route.text} plan={context.plan} app={route.app} />
    : null,
}

export const SURFACES: readonly Surface[] = [...PLACES, APP, NOT_FOUND]

export const surfaceFor = (route: ConsoleRoute): Surface | undefined =>
  SURFACES.find((surface) => surface.kinds.includes(route.kind))

export const parseConsoleHash = (hash: string, plan: readonly ConsoleEntry[]): ConsoleRoute => {
  const address = parseAddress(hash)
  for (const surface of SURFACES) {
    const route = surface.claim(address, plan)
    if (route !== undefined) return route
  }
  return unresolved(address, "place", address.parts[0] ?? "")
}
