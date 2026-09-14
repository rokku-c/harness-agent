/**
 * `Escape`, composed from the two things that already know what it means.
 *
 * §6.3 gives the key one sentence with two halves, and each half belongs to a
 * different mechanism. "Close the top layer" is Radix's: every layer the console
 * opens is a Radix layer, Radix closes its own topmost one and restores the focus
 * that opened it, and a handler that re-derived which layer was topmost would be
 * a second opinion about a settled question. "Return to the parent screen" is the
 * mounted view's: only the view knows its chain, and `back` already means the one
 * thing that is true with and without a history (`effect-ui-screen-back.ts`).
 *
 * So this file holds the join, and the hook that asks it. Three questions, in the
 * order they have to be asked: is a control that owns its own keystrokes focused
 * (then the key is nobody's), is a layer open (then it is Radix's), and is there
 * a mounted screen to leave (then it is the view's). Only when all three are no
 * does the shell use the press, and then it uses it on the address's own parent
 * (`console-parent.ts`) — which is what a reader on `#inbox/<id>` or `#tools/a/b`
 * has no other key for. A place with no second level leaves the key alone.
 *
 * Reading the layer has to happen on the way *down* the tree, before Radix sees
 * the same event: Radix closes its layer inside it, so by the time a bubbling
 * handler ran the dialog would be gone, the console would read "no layer", and
 * one press would make two moves. A capture listener is what makes §6.3's two
 * halves exclusive.
 *
 * A tooltip is not a layer here. It closes on a pointer move, and swallowing the
 * key for one would make `Escape` do nothing at the moment a reader is most
 * likely to be pressing it.
 */

import * as React from "react"
import { isTypingTarget } from "./console-key-press.ts"

const LAYER = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
].join(", ")

/** Whether a layer is open, and therefore whether `Escape` is Radix's to answer. */
export const layerOpen = (): boolean => document.querySelector(LAYER) !== null

/** The mounted view's own "leave this screen", registered while a screen with a parent is drawn. */
let leave: (() => void) | null = null

export const setScreenLeave = (handler: (() => void) | null): void => { leave = handler }

/**
 * `Escape` with no layer open. It answers whether a mounted screen took the key:
 * false when nothing has registered, which is a place — and a place is not a
 * screen with a parent, so the caller falls back to the address's own parent
 * rather than to a guess.
 */
export const leaveScreen = (): boolean => {
  if (leave === null) return false
  leave()
  return true
}

/** `onParent` runs only when nothing else claimed the key. */
export const useConsoleEscape = (onParent: () => void): void => {
  const latest = React.useRef(onParent)
  React.useEffect(() => { latest.current = onParent })
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || isTypingTarget(event.target) || layerOpen()) return
      event.preventDefault()
      if (!leaveScreen()) latest.current()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [])
}
