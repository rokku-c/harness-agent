/**
 * The address, as React reads it.
 *
 * The address bar is the only route record and console-nav.ts is the only place
 * that writes it; what is here is the other half — a component subscribing to it,
 * so a click, a pasted link and the browser's own back button all arrive the same
 * way.
 *
 * Resolving the hash to a route is not here. Resolution needs the registry, the
 * registry holds React components, and no `.ts` module in this client may reach a
 * `.tsx` one (the repository's root typecheck compiles `.ts` with no `jsx`
 * setting). The shell does it, where the plan and the registry are already in
 * hand.
 *
 * `useDestination` is separate because the screen a mounted view is on is the
 * *view's* question, not the shell's: a view asks what screen the address names
 * without needing to know what place claims it.
 */

import * as React from "react"
import { parseDestination, type ConsoleDestination } from "./console-route.ts"

/** The hash, and a subscription that re-renders when it changes. */
export const useAddress = (): string => {
  const [hash, setHash] = React.useState(() => window.location.hash)
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return hash
}

/** The screen the address bar names. Read on its own: the view in the panel is what asks, not the shell. */
export const useDestination = (): ConsoleDestination => {
  const hash = useAddress()
  return React.useMemo(() => parseDestination(hash), [hash])
}
