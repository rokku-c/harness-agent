/**
 * Reading the console's route out of the address bar.
 *
 * The hash is the only route record; React state is derived from it, so a
 * back button, a pasted link and a click all take the same path. Nothing here
 * keeps a second copy of where the reader is.
 */

import * as React from "react"
import { parseConsoleHash, parseDestination, type ConsoleDestination, type ConsoleEntry, type ConsoleRoute } from "./console-plan.ts"

/** The screen and its parameters, as the tail of an app's hash. */
const tailOf = (route: ConsoleRoute): string => {
  const screen = route.screen === undefined ? "" : `/${encodeURIComponent(route.screen)}`
  const query = new URLSearchParams(Object.entries(route.params ?? {})).toString()
  return query === "" ? screen : `${screen}?${query}`
}

export const hashOf = (route: ConsoleRoute): string => {
  const id = route.id === undefined ? "" : encodeURIComponent(route.id)
  switch (route.kind) {
    case "home": return "#"
    case "settings": return "#settings"
    case "settings-config": return `#settings/config/${id}`
    default: return `#${route.kind}/${id}${tailOf(route)}`
  }
}

export const navigate = (route: ConsoleRoute): void => { window.location.hash = hashOf(route) }

/**
 * Enters a screen of an app. Every one of these is a history entry of its own,
 * which is what makes the browser's back button the way back — the same stack
 * Android keeps per task and iOS keeps per navigation controller, kept here by
 * the one thing that already keeps it.
 */
export const openScreen = (id: string, destination: ConsoleDestination): void =>
  navigate({ kind: "view", id, ...destination })

/** The screen the address bar names. Read on its own: the view in the panel is what asks, not the shell. */
export const useDestination = (): ConsoleDestination => {
  const [hash, setHash] = React.useState(() => window.location.hash)
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return React.useMemo(() => parseDestination(hash), [hash])
}

/** Re-parsed whenever the plan changes, so a deep link resolves once the catalogue lands. */
export const useRoute = (plan: readonly ConsoleEntry[]): ConsoleRoute => {
  const [hash, setHash] = React.useState(() => window.location.hash)
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return React.useMemo(() => parseConsoleHash(hash, plan as ConsoleEntry[]), [hash, plan])
}
