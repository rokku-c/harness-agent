/**
 * The last app the operator was in, at the screen they left it on, for `g l`.
 *
 * It is one slot and not a stack, because the key has one job: to come back to
 * the app you stepped out of, on the screen you were working in. The full route
 * is what is kept — app, screen and parameters — since "the screen you left" is
 * the whole of the promise, and a route that dropped its parameters would land
 * on a screen with nothing selected.
 *
 * Nothing here is a second route record. The address bar is still the only one
 * (`console-nav.ts`); this is the answer to a question the address bar cannot
 * answer, which is the same standing `console-stack.ts` has. A screen change
 * updates the slot, a visit to a place does not: leaving an app for Home is
 * exactly the move that must not erase where you were.
 */

import type { ConsoleRoute } from "./console-route.ts"

type AppRoute = Extract<ConsoleRoute, { kind: "app" }>

let last: AppRoute | null = null

/** Called with every route the shell resolves. Only an app route is remembered. */
export const rememberApp = (route: ConsoleRoute): void => {
  if (route.kind === "app") last = route
}

/** Where `g l` goes, or `undefined` on a console nobody has opened an app on yet. */
export const lastApp = (): ConsoleRoute | undefined => last ?? undefined
