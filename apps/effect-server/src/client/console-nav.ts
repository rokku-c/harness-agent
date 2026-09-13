/**
 * Reading the console's route out of the address bar.
 *
 * The hash is the only route record; React state is derived from it, so a
 * back button, a pasted link and a click all take the same path. Nothing here
 * keeps a second copy of where the reader is.
 */

import * as React from "react"
import type { ConsoleDestination, ConsoleRoute } from "./console-plan.ts"
import { pushed } from "./console-stack.ts"

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

/** The address as the browser reads it back: Home is the empty hash, not `#`. */
const here = (): string => window.location.hash === "" ? "#" : window.location.hash

/**
 * Goes to a destination. Pressing something that goes where the reader already
 * is does nothing — not a second history entry behind the same address, which
 * would leave Back returning them to the screen they never left. A press that
 * enters the screen it is on is how a screen completes itself on arrival
 * (`UiScreen.onEnter`), so this is a case the flows take constantly.
 */
export const navigate = (route: ConsoleRoute): void => {
  const hash = hashOf(route)
  if (hash === here()) return
  pushed(hash)
  window.location.hash = hash
}

/**
 * Enters a screen of an app. Every one of these is a history entry of its own,
 * which is what makes the browser's back button the way back — the same stack
 * Android keeps per task and iOS keeps per navigation controller, kept here by
 * the one thing that already keeps it.
 *
 * It is also recorded as a step this session walked (console-stack.ts), which is
 * what lets the back control on that screen use the browser's own history when
 * there is one, and the screen's parent when the reader pasted the address.
 */
export const openScreen = (id: string, destination: ConsoleDestination): void =>
  navigate({ kind: "view", id, ...destination })

/**
 * Keeps the address bar naming the place that is actually on screen.
 *
 * A link that no longer names anything true — an app this host does not have, an
 * app with nothing to configure, the one-time `#config/<app>` spelling — resolves
 * to the closest thing that does. Left as it was, the bar would keep naming a
 * place that is not there: a link the reader cannot tell is stale, and cannot
 * re-share.
 *
 * Rewritten, not pushed, because the reader did not navigate: nothing behind them
 * changed, and Back must not return them to the same stale link. Held until the
 * catalogue lands, since until it does every app looks absent.
 */
export const useAddressTruth = (route: ConsoleRoute, ready: boolean): void => {
  React.useEffect(() => {
    if (!ready) return
    const truth = hashOf(route)
    if (here() !== truth) window.history.replaceState(null, "", truth)
  }, [ready, route])
}
