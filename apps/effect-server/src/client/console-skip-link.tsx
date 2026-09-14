/**
 * The first thing in the document that takes focus, and it goes past the chrome.
 *
 * A console whose bar is on every route and whose dock floats over every page is
 * a console where a keyboard user pays for the chrome on every navigation, and
 * §10.3's answer is the ordinary one: one control before all of it, which moves
 * focus past all of it, to the surface the address named.
 *
 * It is a button and not an anchor, which here is not a style choice: the
 * console's address *is* its hash, so `href="#console-main"` would not move focus
 * at all — it would navigate the console to a route that does not exist and draw
 * Not found. Moving focus is the whole of what this does.
 *
 * It is `VisuallyHidden` and not merely off-screen: the focus it takes is the
 * focus of a control in the tab order, so it has to be one, and it has to be the
 * first one.
 */

import * as React from "react"
import { VisuallyHidden } from "@radix-ui/themes"

export const SkipLink = ({ target }: { readonly target: React.RefObject<HTMLElement | null> }) =>
  <VisuallyHidden asChild>
    <button type="button" onClick={() => target.current?.focus({ preventScroll: true })}>Skip to content</button>
  </VisuallyHidden>
