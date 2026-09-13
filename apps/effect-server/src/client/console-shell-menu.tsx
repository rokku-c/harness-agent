/**
 * The way back out of an app.
 *
 * An open app owns the surface, so the dock is not drawn while one is open —
 * which leaves this as the whole of the navigation still on screen. It goes
 * Home, which is where the launcher is.
 */

import * as React from "react"
import { navigate } from "./console-nav.ts"

export const ConsoleShellMenu = () =>
  <button type="button" className="shell-menu" aria-label="Back to Home" title="Back to Home"
    onClick={() => navigate({ kind: "home" })}>☰</button>
