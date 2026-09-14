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
