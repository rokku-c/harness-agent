import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Place } from "./console-place.ts"

export const placeFor = (route: ConsoleRoute, places: readonly Place[]): Place | undefined =>
  places.find((place) => place.kinds.includes(route.kind))

export const titleOf = (route: ConsoleRoute, plan: readonly ConsoleEntry[], places: readonly Place[]): string => {
  if (route.kind === "app" || route.kind === "app-settings") {
    return plan.find((entry) => entry.id === route.id)?.title ?? route.id
  }
  return placeFor(route, places)?.title ?? "Not found"
}
