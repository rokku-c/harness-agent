/**
 * The parent screen of an address, for the places that have one.
 *
 * §6.3's composed `Escape` ends "with no layer open, return to the parent screen",
 * and for an app's screens the mounted view is what answers that — it is the only
 * thing that knows the chain a view declares (`effect-ui-screen-back.ts`). The
 * four surfaces here are the rest: a decision open inside the Inbox, an operation
 * open inside Tools, an app's configuration, and an app's own settings screen.
 * Each is a real second level of a place, each is the address a reader arrives at
 * from a list, and each has exactly one level above it.
 *
 * The parent is derived from the address and from nothing else, which is why this
 * file is four lines of switch: a place is a route, its detail is a route with one
 * more part, and the parent is the part taken off again. Nothing here consults the
 * history — walking back through the entries this session pushed is the mounted
 * view's question, and a place has no push of its own to walk.
 *
 * A route with no parent answers `undefined` and that is a real answer: Home is
 * already the root, and Not found is not a level of anything, so `Escape` on
 * either does nothing rather than guessing at a destination.
 */

import type { ConsoleRoute } from "./console-route.ts"

export const parentRoute = (route: ConsoleRoute): ConsoleRoute | undefined => {
  switch (route.kind) {
    case "inbox": return route.decisionId === undefined ? undefined : { kind: "inbox" }
    case "tools":
      return route.operation === undefined ? undefined
        : { kind: "tools", ...(route.app === undefined ? {} : { app: route.app }) }
    case "settings": return route.app === undefined ? undefined : { kind: "settings" }
    // An app's settings screen is a level of the app, and the level above it is the app itself.
    case "app-settings": return { kind: "app", id: route.id }
    default: return undefined
  }
}
