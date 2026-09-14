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
