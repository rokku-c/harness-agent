/**
 * The `g` prefix: §6.3's five places, and how long the prefix waits.
 *
 * The chord is data beside the registry rather than a branch in the handler,
 * because two things read it and they must agree: the keyboard dispatcher, which
 * is what goes, and the palette's Places group, which prints the key that already
 * goes there (`console-command-destinations.ts`) — so a place whose key changes
 * changes in one place and the palette cannot come to teach a key that does not.
 *
 * `l` is deliberately not a route. §6.3's last chord is not a place but a return:
 * the last app you were in, at the screen you left, which is a slot that only
 * exists once an app has been opened (`console-goto.ts`).
 */

import type { ConsoleRoute } from "./console-route.ts"

export const CHORD_ROUTES: Readonly<Record<string, ConsoleRoute>> = {
  h: { kind: "home" },
  i: { kind: "inbox" },
  a: { kind: "activity", filter: {} },
  t: { kind: "tools" },
  s: { kind: "settings" },
}

/** The `g` prefix waits this long for its second key, and no longer (§6.3). */
export const CHORD_MS = 1500
