/**
 * What the mounted view tells the console about itself, for as long as it is
 * mounted, and takes back when it is not.
 *
 * Two facts about a view are not in any payload the console can read, because
 * they are about the view being *live*: how to leave the screen it is showing
 * (the composed `Escape`, `console-escape.ts`), and which of its declared actions
 * can be run right now (`console-action-registry.ts`). Both are functions of the
 * mounted view's own store, so both are registered by the view while it is on
 * screen and withdrawn on the way out.
 *
 * Withdrawing matters as much as registering. The console draws one surface at a
 * time, so a registration left behind after an unmount is a key that acts on an
 * app no longer on screen, or an action offered for one. Both are cleared with the
 * app id they came in with, so a late cleanup cannot clear a newer registration.
 */

import * as React from "react"
import { setScreenLeave } from "./console-escape.ts"
import { clearMountedActions, setMountedActions } from "./console-action-registry.ts"
import type { ActionRun } from "./console-action-registry.ts"

export const useMountedView = (
  appId: string,
  back: () => void,
  handlers: Readonly<Record<string, ActionRun>>,
): void => {
  React.useEffect(() => {
    setScreenLeave(back)
    return () => setScreenLeave(null)
  }, [back])
  React.useEffect(() => {
    setMountedActions(appId, handlers)
    return () => clearMountedActions(appId)
  }, [appId, handlers])
}
