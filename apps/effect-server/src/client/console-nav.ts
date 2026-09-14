/**
 * Writing the console's address, and reading it back.
 *
 * The hash is the only route record; React state is derived from it, so a back
 * button, a pasted link and a click all take one path, and nothing here keeps a
 * second copy of where the reader is. This file is the write half — the one
 * place that may change the address — and `console-route-hooks.ts` is the read
 * half.
 *
 * What is *not* here any more is the truth-rewriting pass (`useAddressTruth`):
 * an address that names nothing used to be replaced with the nearest address
 * that did, which makes a broken deep link look like a working one and costs the
 * operator the one fact they need. A stale address now stays exactly as written
 * and renders Not found (`flows.md` §2.H13).
 */

import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import type { ConsoleDestination, ConsoleRoute } from "./console-route.ts"
import { pushed } from "./console-stack.ts"

/** One path segment, encoded, or nothing at all when the part is not there. */
const segment = (value: string | undefined): string => value === undefined || value === "" ? "" : `/${encodeURIComponent(value)}`
/** Only the filters an address actually carries: an absent one is absent, not written as the word `undefined`. */
const query = (params: object | undefined): string => {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params ?? {})) if (typeof value === "string" && value !== "") search.set(name, value)
  return search.toString() === "" ? "" : `?${search.toString()}`
}

export const hashOf = (route: ConsoleRoute): string => {
  switch (route.kind) {
    case "home": return "#"
    case "inbox": return `#inbox${segment(route.decisionId)}`
    case "activity": return `#activity${query(route.filter)}`
    case "tools": return `#tools${segment(route.app)}${segment(route.operation)}`
    case "settings": return `#settings${segment(route.app)}`
    // The first screen is the address that names no screen, so one screen has one address and not two.
    case "app": return `#app/${encodeURIComponent(route.id)}${segment(route.screen === ROOT_SCREEN ? undefined : route.screen)}${query(route.params)}`
    case "app-settings": return `#app/${encodeURIComponent(route.id)}/settings`
    // A not-found keeps the address it failed to resolve; writing it again is how that stays true.
    case "not-found": return route.address === "" ? "#" : route.address
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
 * what lets the return control on that screen use the browser's own history when
 * there is one, and the screen's declared parent when the reader pasted the
 * address.
 */
export const openScreen = (id: string, destination: ConsoleDestination): void =>
  navigate({ kind: "app", id, ...destination })
