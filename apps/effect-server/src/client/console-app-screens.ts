/**
 * The open app's screens, for the palette's screen rows.
 *
 * §10.3's second group is "every screen of the open app", and the only place
 * that knows an app's screens is the payload its view is mounted from. The
 * palette cannot ask the mounted view for them: that view is a React root of its
 * own (`effect-ui-client.tsx`), and the shell has no handle into it.
 *
 * So it reads the same payload for itself — and only while it is open, because
 * the component that calls this is mounted only while the palette is open. The
 * cost is one read of an endpoint the surface on screen has already read, paid
 * on a keystroke, in exchange for a palette that holds no copy of an app's
 * screens and cannot show a stale one.
 *
 * A read that fails is an empty list and not an error: the screen rows are one
 * group of a palette, and the surface behind it is where a failed view says so
 * in its own words.
 */

import * as React from "react"
import { isView, loadView } from "./console-view-read.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export const useAppScreens = (id: string | undefined): readonly ScreenPayload[] => {
  const [screens, setScreens] = React.useState<readonly ScreenPayload[]>([])
  React.useEffect(() => {
    if (id === undefined) return
    let live = true
    void loadView(id).then(
      (read) => { if (live) setScreens(isView(read) ? read.screens : []) },
      () => { if (live) setScreens([]) },
    )
    return () => { live = false }
  }, [id])
  return screens
}
