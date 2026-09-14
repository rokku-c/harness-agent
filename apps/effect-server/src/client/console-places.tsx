/**
 * The registry every surface registers into, and the one lookup that resolves an
 * address.
 *
 * `flows.md` §9.9 is the mechanism this file is: a contribution registry for the
 * places, so that adding a place — or an app, or the Not found pane — is a
 * registration rather than a branch in the shell. The five places are the whole
 * of `PLACES`; the apps and Not found are registered in the same shape without
 * being places, because an app's address carries an app id and Not found is not a
 * destination at all.
 *
 * Resolution is a walk down the same list, first claim wins, and the last word is
 * always Not found with the address it failed to resolve (§9.10). Nothing here
 * rewrites the address and nothing here falls back to Home: the failure this
 * replaces was exactly that fallback, which made a broken link look like a
 * working one (`console-surface` §6).
 */

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

/** The five host-owned destinations, in the order the dock draws them. */
export const PLACES: readonly Place[] = [HOME, INBOX, ACTIVITY, TOOLS, SETTINGS]

/**
 * An address that resolved to nothing. It registers like any other surface and
 * claims nothing, so the resolver's last word is this and the shell's dispatch
 * never needs a case for it.
 */
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

/** The address, resolved: the first surface that claims it, or Not found at that address. */
export const parseConsoleHash = (hash: string, plan: readonly ConsoleEntry[]): ConsoleRoute => {
  const address = parseAddress(hash)
  for (const surface of SURFACES) {
    const route = surface.claim(address, plan)
    if (route !== undefined) return route
  }
  return unresolved(address, "place", address.parts[0] ?? "")
}
