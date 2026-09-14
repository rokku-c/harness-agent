/**
 * What a place is, as an object the shell can be handed.
 *
 * `flows.md` §1.4 settles on five host-owned places, and §1.6 says why it must:
 * today's three siblings are three different mechanisms — Activity is an
 * app-shaped view route special-cased in the shell, Settings is a plan entry
 * special-cased inside the route, the tool inspector is served under an app's
 * own address — and three mechanisms for one job is what leaves the fourth
 * question ("where does a decision wait?") with nowhere to be asked. So a place
 * declares its own address, claims the addresses it owns, and draws them. The
 * shell holds no list of place names and no branch per place: a place is a
 * registration, not a case, which is the one thing that keeps this IA from
 * becoming the old special-casing with five names instead of three.
 *
 * The app family and the not-found pane are registered in the same shape
 * (`console-places.ts`). Neither is a place — an app's address carries an app id,
 * so it does not exist when zero apps are registered, and Not found is not a
 * destination at all — but sharing the shape is what keeps the shell's dispatch a
 * single lookup with no branch anywhere in it.
 */

import type * as React from "react"
import type { Address, ConsoleRoute } from "./console-route.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

/** What a surface is given besides the address: what the apps registered, how to open config, what the host reports. */
export interface PlaceContext {
  readonly plan: readonly ConsoleEntry[]
  readonly surfaces: ConsoleSurfaces
  /** The status line the chrome is already showing, so a place can name the host's services without a second read. */
  readonly status: string
  /**
   * The catalogue read's failure and its retry. The plan above is only as good as
   * this read, and H1 puts the notice where the plan is used, so the shell keeps
   * the read — one read, one plan — and hands both down.
   */
  readonly catalogue: { readonly failure?: string; readonly retry: () => void }
}

/**
 * How the shell frames a surface. A place is a document: as tall as its content,
 * on the design system's own page width. An app is a tool: exactly the area the
 * chrome leaves, so its view can say which of its own parts scrolls.
 */
export type Chrome = "page" | "fill"

/** An address claim, and the view that answers it. One mechanism, three registrants: five places, the apps, Not found. */
export interface Surface {
  /**
   * The route kinds this surface both claims and draws. One list for both, so a
   * surface cannot claim an address it does not know how to render.
   */
  readonly kinds: readonly ConsoleRoute["kind"][]
  readonly chrome: Chrome
  /** The route this surface gives the address, or `undefined` when the address is not its own. */
  readonly claim: (address: Address, plan: readonly ConsoleEntry[]) => ConsoleRoute | undefined
  readonly view: (route: ConsoleRoute, context: PlaceContext) => React.ReactNode
}

/** A destination the host owns: it exists with zero apps, and it has an address with no app id in it. */
export interface Place extends Surface {
  readonly id: string
  readonly title: string
  /** What this place is with nothing of its own selected: its address, and what its dock tile opens. */
  readonly route: ConsoleRoute
  /** The mark and palette the place draws with, declared for the same reason an app declares its own. */
  readonly mark: string
  readonly color: string
}
