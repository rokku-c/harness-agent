/**
 * What §6.3's non-palette keys do, as one object the dispatcher is handed.
 *
 * These are the keys that move rather than the keys that open: the five chords and
 * `g l`, the two arrows, `/`, and the copy. Collecting them here rather than
 * inline in the chrome keeps each one next to the rule that decides it, and keeps
 * the chrome to the part that is about drawing.
 *
 * Two of them are worth their own sentence.
 *
 * **Up one level** is the history when this session walked here and the address's
 * parent when the reader pasted it (`console-stack.ts`, `console-parent.ts`). A
 * mounted screen answers `Escape` and `${BACK}+Left` for itself, so what reaches
 * here is a place with a second level — a decision open in the Inbox, an operation
 * open in Tools — and a route with neither does nothing rather than guessing.
 *
 * **`/`** focuses the first control on the surface that declared one. It is found
 * by attribute and not by a ref, because the chrome draws no part of a place: a
 * ref would mean every surface telling the chrome about its own controls, which is
 * the coupling a marker avoids.
 *
 * A `g` chord to an app with no slot yet (`g l` before any app was opened) does
 * nothing at all. The alternative — going to Home — would be a key that means one
 * thing and then another.
 */

import * as React from "react"
import { navigate } from "./console-nav.ts"
import { canGoBack } from "./console-stack.ts"
import { lastApp } from "./console-goto.ts"
import { copyDeepLink } from "./console-deep-link.ts"
import { parentRoute } from "./console-parent.ts"
import type { ConsoleKeys } from "./console-keyboard.ts"
import type { ConsoleRoute } from "./console-route.ts"

/** Everything the dispatcher needs except the palette, which is the layer state's own (`console-layers.ts`). */
export type ConsoleMoves = Pick<ConsoleKeys, "go" | "goLast" | "back" | "forward" | "focusFilter" | "copyLink">

export const useConsoleMoves = (
  route: ConsoleRoute,
  body: React.RefObject<HTMLElement | null>,
): ConsoleMoves => {
  const back = React.useCallback(() => {
    if (canGoBack()) { window.history.back(); return }
    const parent = parentRoute(route)
    if (parent !== undefined) navigate(parent)
  }, [route])
  return {
    go: React.useCallback((target: ConsoleRoute) => navigate(target), []),
    goLast: React.useCallback(() => {
      const last = lastApp()
      if (last !== undefined) navigate(last)
    }, []),
    back,
    forward: React.useCallback(() => window.history.forward(), []),
    focusFilter: React.useCallback(() => {
      body.current?.querySelector<HTMLElement>("[data-filter]")?.focus({ preventScroll: true })
    }, [body]),
    copyLink: React.useCallback(() => void copyDeepLink(), []),
  }
}
