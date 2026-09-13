/**
 * The address, as React reads it.
 *
 * The address bar is the only route record and console-nav.ts is the only place
 * that writes it; what is here is the other half — a component subscribing to it
 * and getting a route back. Both hooks re-read on `hashchange`, so a click, a
 * pasted link and the browser's own back button all arrive the same way.
 */

import * as React from "react"
import { parseConsoleHash, parseDestination, type ConsoleDestination, type ConsoleEntry, type ConsoleRoute } from "./console-plan.ts"

/** The hash, and a subscription that re-renders when it changes. */
const useHash = (): string => {
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
  const hash = useHash()
  return React.useMemo(() => parseDestination(hash), [hash])
}

/** Re-parsed whenever the plan changes, so a deep link resolves once the catalogue lands. */
export const useRoute = (plan: readonly ConsoleEntry[]): ConsoleRoute => {
  const hash = useHash()
  return React.useMemo(() => parseConsoleHash(hash, plan as ConsoleEntry[]), [hash, plan])
}
