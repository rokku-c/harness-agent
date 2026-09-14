/**
 * What the chrome calls a route: the app's own title, or the place's.
 *
 * It lives in a `.ts` module because both halves of the console need it — the
 * chrome, which is React, and the palette's rows, which are not — and a module
 * with no JSX in it is the only one both can import.
 *
 * The places are an argument rather than an import, and that is what keeps this
 * file out of the registry: `console-places.tsx` holds the place objects, and a
 * `.ts` module reaching into a `.tsx` one is a dependency the TypeScript project
 * does not allow. Handing the list in also means the answer is about the places
 * the caller is drawing, rather than about a list this module happens to hold.
 */

import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"

/** The place this route is in, when it is in one: an app address and Not found are not places. */
export const placeFor = (route: ConsoleRoute, places: readonly Place[]): Place | undefined =>
  places.find((place) => place.kinds.includes(route.kind))

export const titleOf = (route: ConsoleRoute, plan: readonly ConsoleEntry[], places: readonly Place[]): string => {
  if (route.kind === "app" || route.kind === "app-settings") {
    return plan.find((entry) => entry.id === route.id)?.title ?? route.id
  }
  return placeFor(route, places)?.title ?? "Not found"
}
