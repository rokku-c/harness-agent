/**
 * Where focus goes when the route changes.
 *
 * Without this a keyboard user is stranded at the top of the document after
 * every navigation, which is the state §10.3 replaces: on every route change the
 * console focuses the route's heading — the one a surface declared, or otherwise
 * the topmost heading it drew — and a route with no heading at all takes focus on
 * the shell body, which is a real target because the shell gives it a
 * `tabindex`.
 *
 * The look happens one frame later, and that is forced rather than cautious. A
 * view's screens arrive from a read that the route change itself started, so at
 * the moment the shell commits, the surface the reader is arriving at may not be
 * in the document yet; reading it in the shell's own effect would sometimes find
 * the heading of the screen the operator just left. The frame is the commit that
 * settles it.
 *
 * The focus move never scrolls. §12 asks for that: on a document route the
 * operator's scroll position is theirs, and arriving at a heading is not a reason
 * to move the page under them.
 */

import * as React from "react"
import { hashOf } from "./console-nav.ts"
import { isTypingTarget } from "./console-key-press.ts"
import type { ConsoleRoute } from "./console-route.ts"

/** The route's heading: the one a surface declared, or the topmost heading it drew. */
const headingIn = (body: HTMLElement): HTMLElement | null =>
  body.querySelector<HTMLElement>("[data-route-heading]") ?? body.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6")

export const useRouteFocus = (route: ConsoleRoute, body: React.RefObject<HTMLElement | null>): void => {
  const address = hashOf(route)
  React.useEffect(() => {
    const node = body.current
    // A route change cannot come from a keystroke inside a text field, since no keystroke
    // inside one navigates — so this is the belt to that brace, and it costs one check.
    if (node === null || isTypingTarget(document.activeElement)) return
    const frame = requestAnimationFrame(() => {
      const heading = headingIn(node)
      if (heading === null) { node.focus({ preventScroll: true }); return }
      heading.setAttribute("tabindex", "-1")
      heading.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [address, body])
}
